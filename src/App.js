import logo from './logo.png';
import examplePic from './PicExample.png';
import React, { useEffect, useRef, useState, } from 'react';
import ImageUploader from "react-images-upload";
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Popup from 'reactjs-popup';
import 'reactjs-popup';
import './index.css';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
// import posenet from '@tensorflow-models/posenet';
const posenet = require('@tensorflow-models/posenet');
require('@tensorflow/tfjs-backend-webgl');

const confidence = 0.8;

const angleWeightFactor = 4.0; // 4 angles of deviation counts as 1 point less.

const canvasHeight = 500;

const rightside = [2, 4, 6, 8, 10, 12, 14, 16];
const leftside = [1, 3, 5, 7, 9, 11, 13, 15];

// dictionary for lines
const keypointlines = {
  5: [6, 7, 11],   // left shoulder to right shoulder, left elbow, Left hip
  6: [8, 12],      // right shoulder to right elbow, right hip
  7: [9],          // left elbow to left wrist
  8: [10],         // right eblow to right wrist
  11: [12, 13],    // left hip to right hip, left knee
  12: [14],        // right hip to right knee
  13: [15],        // left knee to left ankle
  14: [16],        // right knee to right ankle
};

const bodyCoordinates = {
  ear: {}, // Left, Right
  shoulder: {},
  hip: {},
  knee: {}
};

async function estimatePoseOnImage(imageElement) {
  // load the posenet model from a checkpoint
  const net = await posenet.load();

  const pose = await net.estimateSinglePose(imageElement, {
    flipHorizontal: false
  });
  return pose;
}

export default function App() {
  const imgref = useRef();
  const canvasref = useRef();

  const [imgWidth, setImgWidth] = useState(-1);
  const [imgHeight, setImgHeight] = useState(-1);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [picture, setPicture] = useState();
  const [isRightSide, setRightSide] = useState(false);
  const [avgPosture, setAvgPosture] = useState("");
  const [insights, setInsights] = useState("");
  const [score, setScore] = useState("");
  const [headTilt, setHeadTilt] = useState();
  const [backTilt, setBackTilt] = useState();

  const onDrop = picture => {
    let reader = new FileReader();
    reader.onload = (e) => {
      setPicture(e.target.result);
    }
    reader.readAsDataURL(picture[0]);
  };


  useEffect(() => {
    if (picture) {
      setImgWidth(imgref.current.naturalWidth);
      setImgHeight(imgref.current.naturalHeight);
      // console.log(pictures);
      const pose = estimatePoseOnImage(imgref.current);
      // console.log(pose);
      pose.then((res) => {
        //console.log(res);
        //console.log(canvasref.current);
        //console.log(imgref.current);

        let ctx = canvasref.current.getContext('2d');
        let scale = 1;
        // let scale = 1.0 * imgHeight / canvasHeight; // get the min scale to fit
        // let aspect = 1.0 * imgWidth / imgHeight;
        // console.log(aspect);
        // setCanvasHeight(500);
        // setCanvasWidth(canvasHeight * aspect);
        let x = (ctx.canvas.width - (imgWidth * scale) ) / 2; // centre x
        let y = (ctx.canvas.height - (imgHeight * scale) ) / 2; // centre y
        // ctx.drawImage(imgref.current)
        ctx.drawImage(imgref.current, x, y, imgWidth * scale, imgHeight * scale); // draw scaled img onto the canvas.
        // loop through keypoints
        for (let i = 0; i < res.keypoints.length; i++) {
          // A keypoint is an object describing a body part (like rightArm or leftShoulder)
          let keypoint = res.keypoints[i];

          // Assign coordinates.
          let bodyPart = {};
          bodyPart.x = keypoint.position.x;
          bodyPart.y = keypoint.position.y;
          if (keypoint.part === "leftEar") {
            bodyCoordinates.ear.left = bodyPart;
          } else if (keypoint.part === "rightEar") {
            bodyCoordinates.ear.right = bodyPart;
          } else if (keypoint.part === "leftShoulder") {
            bodyCoordinates.shoulder.left = bodyPart;
          } else if (keypoint.part === "rightShoulder") {
            bodyCoordinates.shoulder.right = bodyPart;
          } else if (keypoint.part === "leftHip") {
            bodyCoordinates.hip.left = bodyPart;
          } else if (keypoint.part === "rightHip") {
            bodyCoordinates.hip.right = bodyPart;
          } else if (keypoint.part === "leftKnee") {
            bodyCoordinates.knee.left = bodyPart;
          } else if (keypoint.part === "rightKnee") {
            bodyCoordinates.knee.right = bodyPart;
          }

          // draw lines
          // Only draw an ellipse is the pose probability is bigger than confidence
          if (keypoint.score > confidence) {
            // point
            ctx.fillStyle = "#00FFFF";
            ctx.beginPath();
            ctx.arc(keypoint.position.x, keypoint.position.y, 4, 0, 2 * Math.PI, true);
            ctx.fill();

            // line
            if (i in keypointlines) {
              for (let con in keypointlines[i]) {
                if (res.keypoints[keypointlines[i][con]].score > confidence) {
                  // console.log("draw line from " + i + " to " + keypointlines[i][con]);
                  ctx.beginPath();
                  ctx.moveTo(keypoint.position.x, keypoint.position.y);
                  ctx.lineTo(res.keypoints[keypointlines[i][con]].position.x, res.keypoints[keypointlines[i][con]].position.y);

                  ctx.lineWidth = 3;
                  ctx.strokeStyle = "#00FFFF";
                  ctx.stroke();
                }
              }
            }
          }

          // compute average left or right side
          if (rightside.includes(i)) {
            rightScore += keypoint.score;
          }
          else if (leftside.includes(i)) {
            leftScore += keypoint.score;
          }
        } // Drawing canvas.
        analyzePosture();
      })
    }
  }, [picture, imgHeight, imgWidth]);

  let rightScore = 0;
  let leftScore = 0;

  const hipShoulderWeight = .75;
  const shoulderEarWeight = .25;

  const rightSideConfidenceAvg = rightScore / rightside.length;
  const leftSideConfidenceAvg = leftScore / leftside.length;

  // Main parts coordinates.
  let hipCordinates = []; // Origin coordinate.
  let kneeCordinates = [];
  let shoulderCoordinates = [];
  let earCoordinates = [];

  function goodImageQuality(leftConfidence, rightConfidence) {
    const differenceMin = .2;
    const difference = Math.abs(leftConfidence - rightConfidence);
    return difference > differenceMin;
  }

  function determineImgSide() {
    if (rightSideConfidenceAvg > leftSideConfidenceAvg) {
      setRightSide(true);
    }
    if (isRightSide) {
      hipCordinates.push(bodyCoordinates.hip.right.x);
      hipCordinates.push(bodyCoordinates.hip.right.y);
      kneeCordinates.push(bodyCoordinates.knee.right.x);
      kneeCordinates.push(bodyCoordinates.knee.right.y);
      shoulderCoordinates.push(bodyCoordinates.shoulder.right.x);
      shoulderCoordinates.push(bodyCoordinates.shoulder.right.y);
      earCoordinates.push(bodyCoordinates.ear.right.x);
      earCoordinates.push(bodyCoordinates.ear.right.y);
    } else { // Left side parts.
      hipCordinates.push(bodyCoordinates.hip.left.x);
      hipCordinates.push(bodyCoordinates.hip.left.y);
      kneeCordinates.push(bodyCoordinates.knee.left.x);
      kneeCordinates.push(bodyCoordinates.knee.left.y);
      shoulderCoordinates.push(bodyCoordinates.shoulder.left.x);
      shoulderCoordinates.push(bodyCoordinates.shoulder.left.y);
      earCoordinates.push(bodyCoordinates.ear.left.x);
      earCoordinates.push(bodyCoordinates.ear.left.y);
    }
  }

  function getHipShoulderAngle() {
    let xYaxisVec = 0;
    let yYaxisVec = 1; // Arbitrary 1 value just to go straight up
    let xShoulderVec = shoulderCoordinates[0] - hipCordinates[0];
    let yShoulderVec = hipCordinates[1] - shoulderCoordinates[1];
    return Math.abs((Math.atan2(yShoulderVec, xShoulderVec) - Math.atan2(yYaxisVec, xYaxisVec)) * 180 / Math.PI);
  }

  function getShoulderEarAngle() {
    let xEarVec = earCoordinates[0] - shoulderCoordinates[0];
    let yEarVec = shoulderCoordinates[1] - earCoordinates[1];
    let xYaxisVec = 0;
    let yYaxisVec = 1; // Arbitrary 1 value just to go straight up
    return Math.abs((Math.atan2(yEarVec, xEarVec) - Math.atan2(yYaxisVec, xYaxisVec)) * 180 / Math.PI);
  }

  function analyzePosture() {
    const expectedShoulderAngle = 0;
    const expectedEarAngle = 0;
    determineImgSide();
    let hipShoulderAngle = getHipShoulderAngle();
    let shoulderEarAngle = getShoulderEarAngle();

    let shoulderAngleDeviation = Math.abs(expectedShoulderAngle - hipShoulderAngle);
    let earAngleDeviation = Math.abs(expectedEarAngle - shoulderEarAngle);

    // Evaluating perfect posture score.
    let postureScore = getPostureScore(shoulderAngleDeviation, earAngleDeviation);
    if (postureScore >= 0 && postureScore < 5) {
      setAvgPosture("Poor Posture")
    }
    else if (postureScore >= 5 && postureScore < 8) {
      setAvgPosture("Average Posture")
    }
    else if (postureScore >= 8 && postureScore <= 10) {
      setAvgPosture("Great Posture")
    }

    setInsights("Insights:");
    setScore(postureScore.toFixed(2)+"/10");

    let backScore = Math.round(shoulderAngleDeviation / angleWeightFactor);
    let neckScore = Math.round(earAngleDeviation / angleWeightFactor);

    // Shoulder to hip analysis.
    if (backScore >= 0 && backScore < 2) {
      setBackTilt("Back Straightness: Your back is straight!");
    }
    else if (backScore >= 2 && backScore < 4) {
      setBackTilt("Back Straightness: Your back is slightly tilted - try aligning it upright");
    }
    else if (backScore >= 4) {
      setBackTilt("Back Straightness: Your back is very curved - try aligning it upright");
    }

    // Ear to shoulder analysis.
    if (neckScore >= 0 && neckScore < 4) {
      setHeadTilt("Neck Position: Your neck is positioned well!");
    }
    else if (neckScore >= 4 && neckScore < 8) {
      setHeadTilt("Neck Position: Your neck is slightly in front of your body - try aligning it above your shoulders");
    }
    else if (neckScore >= 8) {
      setHeadTilt("Neck Position: Your neck is too far in front of your body - try aligning it above your shoulders");
    }
  }

  function getPostureScore(shoulderDeviation, earDeviation) {
    let shoulderScoreOffset = hipShoulderWeight * (shoulderDeviation / angleWeightFactor);
    let earScoreOffset = shoulderEarWeight * (earDeviation / angleWeightFactor);
    let score =  (10.0 - (shoulderScoreOffset + earScoreOffset)); // Score out of 10.
    return score < 0 ? 0 : score;
  }

  return (
    <div className="App">
      <Navbar bg="dark" variant="dark">
        <Navbar.Brand href="#home">
          <img
            alt=""
            src={logo}
            width="30"
            height="30"
            className="d-inline-block align-top"
          />{' '}
          Perfect Posture
          {' '}
        </Navbar.Brand>
        <Nav className="mr-auto">
        </Nav>
        <Nav>
          <Popup
            trigger={<button size="sm" align="right">Help</button>}
            position="bottom right">
              <h5> HOW TO TAKE PIC</h5>
              <p> Welcome to Perfect Posture. To get the best analysis, please submit a seated side view picture with as little obstruction as possible.</p>
              <p>You can follow the example below for optimal results.</p>
              <img
                alt=""
                src={examplePic}
                width="120"
                height="176"
                className="d-inline-block align-top"
              />
              <br></br>
              <h5>ANALYSIS</h5>
              <p>The following general guidelines can help you get a better sense of your score and insights.</p>
              <p>1) (0-4) Really bad, (4-7) decent, (7-9) good, (9-10) fantastic.</p>
              <p>2) If your head tilt is greater than ~10° then push head back.</p>
              <p>3) If your shoulder tilt is greater than ~10° then push shoulders back.</p>
          </Popup>
        </Nav>
      </Navbar>
      <div className="body">
        <div className="upload">
          <ImageUploader
            withIcon={true}
            singleImage={true}
            onChange={onDrop}
            imgExtension={[".jpg", ".gif", ".png", ".gif"]}
            maxFileSize={5242880}
          />
          <img src={picture} alt="upload" style={{display: 'none'}} ref={imgref}/>
          <canvas width={imgWidth} height={imgHeight} ref={canvasref} />
          <br></br>
          <div className="insights-text">
            <div><b>{ avgPosture }</b></div>
            <div><b>{ score }</b></div>
            <div>{ insights } </div>
            <div>{ headTilt } </div>
            <div>{ backTilt } </div>
          </div>
        </div>
    </div>
    </div>
  );
}
