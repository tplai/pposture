import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, } from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
// import posenet from '@tensorflow-models/posenet';
const posenet = require('@tensorflow-models/posenet');
require('@tensorflow/tfjs-backend-webgl');

async function estimatePoseOnImage(imageElement) {
  // load the posenet model from a checkpoint
  const net = await posenet.load();

  const pose = await net.estimateSinglePose(imageElement, {
    flipHorizontal: false
  });
  return pose;
}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const rightside = [2, 4, 6, 8, 10, 12, 14, 16];
const leftside = [1, 3, 5, 7, 9, 11, 13, 15];

const confidence = 0.7;

const imgHeight = 417;
const imgWidth = 357;

export default function App() {
  const imgref = useRef();
  const canvasref = useRef();

  useEffect(() => {
    const pose = estimatePoseOnImage(imgref.current)
    // console.log(pose);
    pose.then((res) => {
      console.log(res);
      // console.log(canvasref.current);
      let ctx = canvasref.current.getContext('2d');
      let scale = 1; // get the min scale to fit
      let x = (ctx.canvas.width - (imgWidth * scale) ) / 2; // centre x
      let y = (ctx.canvas.height - (imgHeight * scale) ) / 2; // centre y

      ctx.drawImage(imgref.current, x, y, imgWidth * scale, imgHeight * scale); // draw scaled img onto the canvas.

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

  let rightscore = 0;
  let leftscore = 0;

  const hipShoulderWeight = .75;
  const shoulderEarWeight = .25;

  const rightSideConfidenceAvg = rightscore / rightside.length;
  const leftSideConfidenceAvg = leftscore / leftside.length;

  let isRightSide = false;

  // Main parts coordinates.
  let hipCordinates; // Origin coordinate.
  let kneeCordinates;
  let shoulderCoordinates;
  let earCoordinates;

  // Main part angles.
  //let hipShoulderAngle;
  //let shoulderEarAngle;

  function goodImageQuality(leftConfidence, rightConfidence) {
    const differenceMin = .2; 
    const difference = Math.abs(leftConfidence - rightConfidence);
    return difference > differenceMin;
  }

  function determineImgSide() {
    if (rightSideConfidenceAvg > leftSideConfidenceAvg) {
      isRightSide = true;
    } 
  }

  function getHipShoulderAngle() {
    let xOrigin = hipCordinates[0];
    let yOrigin = hipCordinates[1];
    let xKneeVec = kneeCordinates[0] - xOrigin;
    let yKneeVec = kneeCordinates[1] - yOrigin;
    let xShoulderVec = shoulderCoordinates[0] - xOrigin;
    let yShoulderVec = shoulderCoordinates[0] - yOrigin;
    return Math.atan((xKneeVec-xShoulderVec)/(yKneeVec-yShoulderVec));
  }

  function getShoulderEarAngle() {
    let xOrigin = hipCordinates[0];
    let yOrigin = hipCordinates[1];
    let xEarVec = earCoordinates[0] - xOrigin;
    let yEarVec = earCoordinates[1] - yOrigin;
    let xShoulderVec = shoulderCoordinates[0] - xOrigin;
    let yShoulderVec = shoulderCoordinates[0] - yOrigin;
    return Math.atan((xEarVec-xShoulderVec)/(yEarVec-yShoulderVec));
  }

  function analyzePosture() {
    const expectedPostureAngle = 90; // Ear and shoulders should be 90 degrees.
    let hipShoulderAngle = getHipShoulderAngle();
    let shoulderEarAngle = getShoulderEarAngle();

    // Shoulder to hip analysis.
    let shoulderAngleDeviation = Math.abs(expectedPostureAngle - hipShoulderAngle);
    if (shoulderAngleDeviation > 6) { // If angle > 6 degrees of deviation, recommend insights..
      console.log("push shoulders back");
    }

    // Ear to shoulder analysis.
    let earAngleDeviation = Math.abs(expectedPostureAngle - shoulderEarAngle);
    if (earAngleDeviation > 6) { // If angle > 6 degrees of deviation, recommend insights..
      console.log("Push your neck back");
    }
    // Evaluating perfect posture score.
    let postureScore = getPostureScore();
  }

  function getPostureScore(shoulderDeviation, earDeviation) {
    const angleWeightFactor = 3; // 3 angles of deviation counts as 1 point less.
    let shoulderScoreOffset = hipShoulderWeight * (shoulderDeviation / angleWeightFactor);
    let earScoreOffset = shoulderEarWeight * (earDeviation / angleWeightFactor);
    let score =  Math.round(10 - (shoulderScoreOffset + earScoreOffset)); // Score out of 10.
    return score < 0 ? 0 : score;
  }

  return (
    <View style={styles.container}>
      <img src={require('./images/gamer2.png')} style={{height: imgHeight, width: imgWidth, resizeMode : 'stretch', display: 'none'}} ref={imgref} />
      <canvas ref={canvasref} width={imgWidth} height={imgHeight}/>
      <StatusBar style="auto" />
    </View>
  );
}
