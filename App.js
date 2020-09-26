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

export default function App() {
  const imgref = useRef();

  useEffect(() => {
    const pose = estimatePoseOnImage(imgref.current)
    // console.log(pose);
    pose.then((res) => {
      console.log(res)
    })
    // console.log(imgref.current);
  });

  return (
    <View style={styles.container}>
      <img src={require('./images/keanu.jpg')} style={{height: 1000, width: 1000, resizeMode : 'stretch',}} ref={imgref} />
      <Text>Open up App.js to start working on your app!</Text>
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
