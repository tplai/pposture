import logo from './logo.png';
import examplePic from './PicExample.png';
import React from 'react';
import ImageUploader from "react-images-upload";
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Popup from 'reactjs-popup';
import Spinner from 'react-spinner-material';
//import "react-loader-spinner/dist/loader/css/react-spinner-loader.css"
import Loader from 'react-loader-spinner'
import 'reactjs-popup';
import './index.css';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
// import posenet from '@tensorflow-models/posenet';
const posenet = require('@tensorflow-models/posenet');
require('@tensorflow/tfjs-backend-webgl');

const confidence = 0.8;

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
      insights: "",
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

    this.onDrop = this.onDrop.bind(this);
    this.drawPose = this.drawPose.bind(this);
    this.verifyImageQuality = this.verifyImageQuality.bind(this);
    this.displayImageError = this.displayImageError.bind(this);
    this.determineImageSide = this.determineImageSide.bind(this);
    this.analyzePosture = this.analyzePosture.bind(this);
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
    this.drawPose();
  };

  drawPose() {
    // begin pose estimation
    this.setState({
      loading: true,
      displayHomepage: false
    });
    this.clearPage();
    const pose = estimatePoseOnImage(this.imgref.current);
    pose.then((res) => {
      let keypoints = res.keypoints;

      if (!this.verifyImageQuality(keypoints)) {
        this.displayImageError();
        return;
      }

      this.setState(prevState => ({
        ...prevState,
        loading: false,
        isValidImg: true,
        imgWidth: this.imgref.current.naturalWidth,
        imgHeight: this.imgref.current.naturalHeight,
        })
      );
      // setIsValidImg(true);
      // setImgWidth(imgref.current.naturalWidth);
      // setImgHeight(imgref.current.naturalHeight);

      let ctx = this.canvasref.current.getContext('2d');
      let scale = 1;
      // let scale = 1.0 * imgHeight / canvasHeight; // get the min scale to fit
      // let aspect = 1.0 * imgWidth / imgHeight;
      // console.log(aspect);
      // setCanvasHeight(500);
      // setCanvasWidth(canvasHeight * aspect);
      let x = (ctx.canvas.width - (this.state.imgWidth * scale) ) / 2; // centre x
      let y = (ctx.canvas.height - (this.state.imgHeight * scale) ) / 2; // centre y
      // ctx.drawImage(imgref.current)
      console.log(this.imgref.current);
      ctx.drawImage(this.imgref.current, x, y, this.state.imgWidth * scale, this.state.imgHeight * scale); // draw scaled img onto the canvas.
      // loop through keypoints
      for (let i = 0; i < keypoints.length; i++) {
        // A keypoint is an object describing a body part (like rightArm or leftShoulder)
        let keypoint = keypoints[i];

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

          // lines
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
      }
      this.analyzePosture();
    })
  }

  verifyImageQuality(keypoints) {
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
      avgPosture: null,
      score: null,
      insights: null,
      headTilt: null,
      backTilt: null,
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

  determineImageSide() {
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

  analyzePosture() {
    this.determineImageSide();
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
      postureStr = "Average Posture";
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
      score: postureScore.toFixed(2)+"/10",
      insights: "Insights:",
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
      insights,
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
                <h5> Our Model</h5>
                <p>We use computer vision to analyzer an image of your posture.
                  Some of the metrics that go into our analysis include
                  examing your back, neck, and shoulder positionings.
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
                imgExtension={[".jpg", ".png", ".gif"]}
                maxFileSize={5242880}
              />
              {displayHomepage ?
                <div className="homepage-info">
                  <span>Welcome to Perfect Posture! To get the best analysis, submit a seated side view picture with as little
                  obstruction as possible. Relax and show us your natural pose!
                  </span>
                  <div className="space"></div>
                  <p>Follow the example below for best results</p>
                  <img
                    alt=""
                    src={examplePic}
                    width="240"
                    height="352"
                    className="d-inline-block align-top"
                    />
                </div>:null
              }
              <img src={picture} alt="upload" style={{display: 'none'}} ref={this.imgref}/>
              <canvas width={imgWidth} height={imgHeight} ref={this.canvasref} />
              {loading ?
                <Loader className="loader-pos"type="TailSpin" color="#00BFFF" height={160} width={160} />
                : null
              }
              {isValidImg ?
                <div className="insights-text">
                  <div><b>{ avgPosture }</b></div>
                  <div><b>{ score }</b></div>
                  <div>{ insights } </div>
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

/*
<br></br>
                <br></br>
                <h5>ALGORITHM</h5>
                <p>Our scoring system takes into consideration your neck, shoulder, and hip position. We calculate how straight your back and neck are to give you the best feedback to improve your posture.</p>
                <br></br>
                <h5>ANALYSIS</h5>
                <p>The following general guidelines can help you get a better sense of your score and insights.</p>
                <p>1) (0-4) Really bad, (4-7) decent, (7-9) good, (9-10) fantastic.</p>
                <p>2) If your head tilt is greater than ~10° then push head back.</p>
                <p>3) If your shoulder tilt is greater than ~10° then push shoulders back.</p>
                */