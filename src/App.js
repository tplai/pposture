import imgsrc from './images/gamer2.png';
import logo from './logo.svg';
import React, { useEffect, useRef, } from 'react';
import Navbar from 'react-bootstrap/Navbar';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css';
// import posenet from '@tensorflow-models/posenet';
const posenet = require('@tensorflow-models/posenet');
require('@tensorflow/tfjs-backend-webgl');

const confidence = 0.8;

const imgHeight = 417;
const imgWidth = 357;

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
}

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

  useEffect(() => {
    const pose = estimatePoseOnImage(imgref.current);
    // console.log(pose);
    pose.then((res) => {
      console.log(res);
      // console.log(canvasref.current);
      let ctx = canvasref.current.getContext('2d');
      let scale = 1; // get the min scale to fit
      let x = (ctx.canvas.width - (imgWidth * scale) ) / 2; // centre x
      let y = (ctx.canvas.height - (imgHeight * scale) ) / 2; // centre y

      ctx.drawImage(imgref.current, x, y, imgWidth * scale, imgHeight * scale); // draw scaled img onto the canvas.

      let rightscore = 0;
      let leftscore = 0;

      // loop through keypoints
      for (let i = 0; i < res.keypoints.length; i++) {
        // A keypoint is an object describing a body part (like rightArm or leftShoulder)
        let keypoint = res.keypoints[i];
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
              // console.log(res.keypoints[keypointlines[i][con]]);
              // console.log(i);
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
          rightscore += keypoint.score;
        }
        else if (leftside.includes(i)) {
          leftscore += keypoint.score;
        }
      }
      // averages
      console.log(`Right side average ${rightscore / rightside.length}`);
      console.log(`Left side average ${leftscore / leftside.length}`);
    })
  });

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
        </Navbar.Brand>
      </Navbar>
      <div className="body">
        <img src={imgsrc} style={{height: imgHeight, width: imgWidth, display: 'none'}} ref={imgref} />
        <canvas ref={canvasref} width={imgWidth} height={imgHeight}/>
      </div>
    </div>
  );
}
