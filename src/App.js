import logo from './assets/logo.png';
import examplePic from './assets/PicExample.png';
import React from 'react';
import ImageUploader from "react-images-upload";
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Popup from 'reactjs-popup';
import 'reactjs-popup';
import './index.css';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

const posenet = require('@tensorflow-models/posenet');
require('@tensorflow/tfjs-backend-webgl');

const scaledHeight = 600;

// minimum difference between avg confidence scores between sides
const differenceMin = .2;

// 4 angles of deviation counts as 1 point less.
const angleWeightFactor = 4.0;

// weight for scoring
const hipShoulderWeight = .75;
const shoulderEarWeight = .25;

// ideal angles
const expectedShoulderAngle = 0;
const expectedEarAngle = 0;

const rightside = [2, 4, 6, 8, 10, 12, 14, 16];
const leftside = [1, 3, 5, 7, 9, 11, 13, 15];

// dictionary for lines
const keypointlines = {
  5: [3, 7, 11],   // left shoulder to left elbow, left hip
  6: [4, 8, 12],   // right shoulder to right elbow, right hip
  7: [9],          // left elbow to left wrist
  8: [10],         // right eblow to right wrist
  11: [13],        // left hip to  left knee
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

function getPostureScore(shoulderDeviation, earDeviation) {
  let shoulderScoreOffset = hipShoulderWeight * (shoulderDeviation / angleWeightFactor);
  let earScoreOffset = shoulderEarWeight * (earDeviation / angleWeightFactor);
  let score =  (10.0 - (shoulderScoreOffset + earScoreOffset)); // Score out of 10.
  return score < 0 ? 0 : score;
}

// xAxis 0, yAxis arbitrary 1 value just to go straight up
function getVerticalAngle(xVec, yVec, xAxisVec, yAxisVec) {
  return Math.abs((Math.atan2(yVec, xVec) - Math.atan2(yAxisVec, xAxisVec)) * 180 / Math.PI);
}

async function estimatePoseOnImage(imageElement) {
  // load the posenet model from a checkpoint
  const net = await posenet.load();

  const pose = await net.estimateSinglePose(imageElement, {
    flipHorizontal: false
  });
  return pose;
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      displayHomepage: true,
      loading: false,
      imgWidth: -1,
      imgHeight: -1,
      picture: -1,
      isValidImg: true,
      isRightSide: false,
      score: "",
      avgPosture: "",
      headTilt: "",
      backTilt: "",
      // Main parts coordinates.
      hipCordinates: [],
      kneeCordinates: [],
      shoulderCoordinates: [],
      earCoordinates: []
    };
    this.imgref = React.createRef();
    this.canvasref = React.createRef();

    this.clearPage = this.clearPage.bind(this);
    this.onDrop = this.onDrop.bind(this);
    this.analyzePosture = this.analyzePosture.bind(this);
    this.verifyImageQualityAndSide = this.verifyImageQualityAndSide.bind(this);
    this.displayImageError = this.displayImageError.bind(this);
    this.assignCorrespondingSideCoordinates = this.assignCorrespondingSideCoordinates.bind(this);
    this.getPostureInsights = this.getPostureInsights.bind(this);
    this.displayHomepage = this.displayHomepage.bind(this);
  }

  onDrop(picture) {
    let reader = new FileReader();
    reader.onload = (e) => {
      this.setState(prevState => ({
        ...prevState,
        picture: e.target.result
        })
      );
    }
    reader.readAsDataURL(picture[0]);
    this.analyzePosture();
  };

  analyzePosture() {
    // begin pose estimation
    this.setState(prevState => ({
      ...prevState,
      loading: true,
      displayHomepage: false,
      })
    );
    this.clearPage();
    const pose = estimatePoseOnImage(this.imgref.current);
    pose.then((res) => {
      let keypoints = res.keypoints;

      if (!this.verifyImageQualityAndSide(keypoints)) {
        this.displayImageError();
        return;
      }
      this.assignBodyCoordinates(keypoints);
      this.drawCanvas(keypoints);
      this.getPostureInsights();
    })
  }

  assignBodyCoordinates(keypoints) {
    // Loop through keypoints
    for (let i = 0; i < keypoints.length; i++) {
      let keypoint = keypoints[i];
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
    }
  }

  drawCanvas(keypoints) {
    let yScale = 1.0 * scaledHeight /  this.imgref.current.naturalHeight;
    let xScale = yScale;

    this.setState(prevState => ({
      ...prevState,
      loading: false,
      isValidImg: true,
      imgWidth: Math.round(this.imgref.current.naturalWidth * xScale),
      imgHeight: Math.round(this.imgref.current.naturalHeight * yScale),
      })
    );

    let rightSide = this.state.rightSide;

    let ctx = this.canvasref.current.getContext('2d');
    let x = (ctx.canvas.width - (this.state.imgWidth) ) / 2; // centre x
    let y = (ctx.canvas.height - (this.state.imgHeight) ) / 2; // centre y
    ctx.drawImage(this.imgref.current, x, y, this.state.imgWidth, this.state.imgHeight); // draw scaled img onto the canvas.
    for (let i = 0; i < keypoints.length; i++) { // loop through keypoints
      let keypoint = keypoints[i]; // A keypoint is an object describing a body part (like rightArm or leftShoulder)

      if ((!rightSide && leftside.includes(i)) || (rightSide && rightside.includes(i))) {
        // point
        ctx.fillStyle = "#00FFFF";
        ctx.beginPath();
        ctx.arc(keypoint.position.x * xScale, keypoint.position.y * yScale, 4, 0, 2 * Math.PI, true);
        ctx.fill();

        // lines
        if (i in keypointlines) {
          for (let con in keypointlines[i]) {
           ctx.beginPath();
           ctx.moveTo(keypoint.position.x * xScale, keypoint.position.y * yScale);
           ctx.lineTo(keypoints[keypointlines[i][con]].position.x * xScale, keypoints[keypointlines[i][con]].position.y * yScale);

           ctx.lineWidth = 3;
           ctx.strokeStyle = "#00FFFF";
           ctx.stroke();
          }
        }
      }
    }
  }

  verifyImageQualityAndSide(keypoints) {
    let rightScore = 0;
    let leftScore = 0;

    for (let i = 0; i < keypoints.length; ++i) {
      let keypoint = keypoints[i];
      // compute average left or right side
      if (rightside.includes(i)) {
        rightScore += keypoint.score;
      }
      else if (leftside.includes(i)) {
        leftScore += keypoint.score;
      }
    }
    let leftSideConfidenceAvg = leftScore / leftside.length;
    let rightSideConfidenceAvg = rightScore / rightside.length;

    let valid = true;
    let rightSide = true;
    if (Math.abs(leftSideConfidenceAvg - rightSideConfidenceAvg) <= differenceMin) {
      valid = false;
    }
    if (rightSideConfidenceAvg < leftSideConfidenceAvg) {
      rightSide = false;
    }
    this.setState(prevState => ({
      ...prevState,
      rightSide: rightSide,
      isValidImg: valid
      })
    );
    return valid;
  }

  displayHomepage() {
    this.setState({
      displayHomepage: true,
    });
    this.clearPage();
  }

  clearPage() {
    this.setState({
      isValidImg: true,
      avgPosture: "",
      score: "",
      headTilt: "",
      backTilt: "",
      imgHeight: 0,
      imgWidth: 0,
    });
  }

  displayImageError() {
    this.setState(prevState => ({
      ...prevState,
      loading: false,
      imgHeight: 0,
      imgWidth: 0,
      })
    );
  }

  assignCorrespondingSideCoordinates() {
    let hipCoords = [];
    let kneeCoords = [];
    let shoulderCoords = [];
    let earCoords = [];
    if (this.state.isRightSide) {
      hipCoords.push(bodyCoordinates.hip.right.x);
      hipCoords.push(bodyCoordinates.hip.right.y);
      kneeCoords.push(bodyCoordinates.knee.right.x);
      kneeCoords.push(bodyCoordinates.knee.right.y);
      shoulderCoords.push(bodyCoordinates.shoulder.right.x);
      shoulderCoords.push(bodyCoordinates.shoulder.right.y);
      earCoords.push(bodyCoordinates.ear.right.x);
      earCoords.push(bodyCoordinates.ear.right.y);
    } else { // Left side parts.
      hipCoords.push(bodyCoordinates.hip.left.x);
      hipCoords.push(bodyCoordinates.hip.left.y);
      kneeCoords.push(bodyCoordinates.knee.left.x);
      kneeCoords.push(bodyCoordinates.knee.left.y);
      shoulderCoords.push(bodyCoordinates.shoulder.left.x);
      shoulderCoords.push(bodyCoordinates.shoulder.left.y);
      earCoords.push(bodyCoordinates.ear.left.x);
      earCoords.push(bodyCoordinates.ear.left.y);
    }
    this.setState(prevState => ({
      ...prevState,
      hipCordinates: hipCoords,
      kneeCordinates: kneeCoords,
      shoulderCoordinates: shoulderCoords,
      earCoordinates: earCoords
      })
    );
  }

  getPostureInsights() {
    this.assignCorrespondingSideCoordinates();
    let xShoulderVec = this.state.shoulderCoordinates[0] - this.state.hipCordinates[0];
    let yShoulderVec = this.state.hipCordinates[1] - this.state.shoulderCoordinates[1];
    let hipShoulderAngle = getVerticalAngle(xShoulderVec, yShoulderVec, 0, 1);


    let xEarVec = this.state.earCoordinates[0] - this.state.shoulderCoordinates[0];
    let yEarVec = this.state.shoulderCoordinates[1] - this.state.earCoordinates[1];
    let shoulderEarAngle = getVerticalAngle(xEarVec, yEarVec, 0, 1);

    let shoulderAngleDeviation = Math.abs(expectedShoulderAngle - hipShoulderAngle);
    let earAngleDeviation = Math.abs(expectedEarAngle - shoulderEarAngle);

    // Evaluating perfect posture score.
    let postureScore = getPostureScore(shoulderAngleDeviation, earAngleDeviation);
    let backScore = Math.round(shoulderAngleDeviation / angleWeightFactor);
    let neckScore = Math.round(earAngleDeviation / angleWeightFactor);

    let postureStr = "";
    let backStr = "";
    let headStr = "";

    if (postureScore >= 0 && postureScore < 5) {
      postureStr = "Poor Posture";
    }
    else if (postureScore >= 5 && postureScore < 8) {
      postureStr = "Fair Posture";
    }
    else if (postureScore >= 8 && postureScore <= 10) {
      postureStr = "Great Posture";
    }

    // Shoulder to hip analysis.
    if (backScore >= 0 && backScore < 2) {
      backStr = "Back Straightness: Your back is straight!";
    }
    else if (backScore >= 2 && backScore < 4) {
      backStr = "Back Straightness: Your back is slightly tilted - try aligning it upright";
    }
    else if (backScore >= 4) {
      backStr = "Back Straightness: Your back is very curved - try aligning it upright";
    }

    // Ear to shoulder analysis.
    if (neckScore >= 0 && neckScore < 4) {
      headStr ="Neck Position: Your neck is positioned well!";
    }
    else if (neckScore >= 4 && neckScore < 8) {
      headStr ="Neck Position: Your neck is slightly in front of your body - try aligning it above your shoulders";
    }
    else if (neckScore >= 8) {
      headStr ="Neck Position: Your neck is too far in front of your body - try aligning it above your shoulders";
    }

    this.setState(prevState => ({
      ...prevState,
      score: Math.round(postureScore)+"/10",
      avgPosture: postureStr,
      backTilt: backStr,
      headTilt: headStr,
      })
    );

  }

  render() {
    const {
      displayHomepage,
      loading,
      picture,
      imgWidth,
      imgHeight,
      isValidImg,
      avgPosture,
      score,
      headTilt,
      backTilt
    } = this.state;

    return (
      <div className="App">
        <Navbar bg="dark" variant="dark">
          <Navbar.Brand href="#home" onClick={this.displayHomepage}>
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
                className="popup-content"
                trigger={<button size="sm" align="right">About Us</button>}
                position="bottom right">
                <h5>The Perfect Posture Model</h5>
                <p>Perfect Posture uses computer vision to analyze an image of your sitting posture.
                  We take some measurements from your body and crunch some numbers to give you insight on ways you can adjust your posture.
                  Your privacy is of utmost importance to us, so all images are immediately deleted after analysis.
                  We do not store any of your images.
                </p>
              </Popup>
            </Nav>
          </Navbar>
          <div className="body">
            <div className="upload">
              <ImageUploader
                withIcon={true}
                singleImage={true}
                onChange={this.onDrop}
                imgExtension={[".jpg", ".jpeg", ".png"]}
                maxFileSize={5242880}
              />
              {displayHomepage ?
                <div className="homepage-info">
                  <span>Welcome to Perfect Posture! To get the most accurate analysis, make sure to submit a seated side view picture with as little
                  obstruction as possible.
                  </span>
                  <div className="space"></div>
                  <p>Follow the example below and show us your natural pose!</p>
                  <img
                    alt=""
                    src={examplePic}
                    width="240"
                    height="352"
                    className="d-inline-block align-top"
                    />
                </div>:null
              }
              <img src={picture} alt="upload" style={{display: 'none', height: scaledHeight, width: 'auto'}} ref={this.imgref}/>
              <canvas width={imgWidth} height={imgHeight} ref={this.canvasref} />
              {isValidImg ?
                <div className="insights-text">
                  <div><b>{ avgPosture }</b></div>
                  <div><b>{ score }</b></div>
                  <div>{ headTilt } </div>
                  <div>{ backTilt } </div>
                </div>
                : <div>Cannot estimate your posture from this image, try takin a better side view picture and make sure the view is not obstructed</div>
              }

          </div>
        </div>
      </div>
    );
  }
}

export default App
