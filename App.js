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
  14: [17],        // right knee to right ankle
}

const confidence = 0.7

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
      let x = (ctx.canvas.width - (960 * scale) ) / 2; // centre x
      let y = (ctx.canvas.height - (640 * scale) ) / 2; // centre y

      ctx.drawImage(imgref.current, x, y, 960 * scale, 640 * scale); // draw scaled img onto the canvas.

      // console.log(res.keypoints[0]);
      for (let i = 0; i < res.keypoints.length; i++) {
        // A keypoint is an object describing a body part (like rightArm or leftShoulder)
        let keypoint = res.keypoints[i];
        // Only draw an ellipse is the pose probability is bigger than 0.7
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
      }
    })
  });

  return (
    <View style={styles.container}>
      <img src={require('./images/jason_scaled.jpg')} style={{height: 640, width: 960, resizeMode : 'stretch', display: 'none'}} ref={imgref} />
      <canvas ref={canvasref} width="960" height="640"/>
      <StatusBar style="auto" />
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
