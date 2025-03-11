import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

const SphereAnimation = () => {
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const [audioContext, setAudioContext] = useState(null);
  const [isMicrophoneActive, setIsMicrophoneActive] = useState(false);
  const [analyser, setAnalyser] = useState(null);
  const [dataArray, setDataArray] = useState(null);
  const animationRef = useRef(null);

  useEffect(() => {
    // 1) Create the Scene, Camera, and Transparent Renderer
    const scene = new THREE.Scene();
    // Remove the background color
    // scene.background = new THREE.Color(0x000000); // <-- remove/comment this out

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // Enable alpha to make background transparent
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Optional: ensure the canvas background is fully transparent:
    renderer.setClearAlpha(0);

    rendererRef.current = renderer;

    if (sceneRef.current) {
      // Remove any old canvases
      while (sceneRef.current.firstChild) {
        sceneRef.current.removeChild(sceneRef.current.firstChild);
      }
      // Append the new canvas
      sceneRef.current.appendChild(renderer.domElement);
    }

    // 2) Create Dots on Sphere
    const radius = 0.5;
    const numDots = 50;
    const sphereSize = 0.02;
    const dots = [];

    const neonColors = [
      0x00ff00,
      0x0000ff,
      0xff00ff,
      0x00ffff,
      0xffff00,
    ];

    const originalPositions = [];

    for (let i = 0; i < numDots; i++) {
      const t = i / (numDots - 1);
      const phi = Math.acos(1 - 2 * t);
      const theta = 2 * Math.PI * 0.618033988749895 * i;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      const geometry = new THREE.SphereGeometry(sphereSize, 16, 16);
      const color = new THREE.Color(
        neonColors[Math.floor(Math.random() * neonColors.length)]
      );
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1,
      });

      const dot = new THREE.Mesh(geometry, material);
      dot.position.set(x, y, z);
      scene.add(dot);

      dots.push(dot);
      originalPositions.push({ x, y, z });
    }

    // 3) Add Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1, 10);
    pointLight.position.set(2, 2, 2);
    scene.add(pointLight);

    let time = 0;

    // 4) Animation Loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      let micVolume = 0;
      let micIntensity = 0;

      if (isMicrophoneActive && analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        const frequencyData = Array.from(dataArray);
        micVolume = Math.max(...frequencyData);
        micIntensity = Math.pow(micVolume / 255, 3) * 0.1;
      }

      const randomNoise = Math.random() * 0.005;
      const combinedIntensity = micIntensity + randomNoise;

      time += 0.1;

      // Update sphere dot positions
      for (let i = 0; i < dots.length; i++) {
        const { x: origX, y: origY, z: origZ } = originalPositions[i];

        const vibrationFactor =
          Math.sin(time + i * 0.2) * combinedIntensity * 2;

        const magnitude = Math.sqrt(origX * origX + origY * origY + origZ * origZ);
        const normX = origX / magnitude;
        const normY = origY / magnitude;
        const normZ = origZ / magnitude;

        dots[i].position.set(
          origX + normX * vibrationFactor,
          origY + normY * vibrationFactor,
          origZ + normZ * vibrationFactor
        );
      }

      // Slow rotation of the entire scene
      scene.rotation.y += 0.005;
      scene.rotation.x += 0.002;

      renderer.render(scene, camera);
    };

    camera.position.z = 2;

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      dots.forEach((dot) => {
        scene.remove(dot);
        dot.geometry.dispose();
        dot.material.dispose();
      });
      if (audioContext) audioContext.close();
    };
  }, [isMicrophoneActive, analyser, dataArray, audioContext]);

  // 5) Microphone Activation
  const startAudioProcessing = () => {
    if (audioContext) return;

    try {
      const newAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      const newAnalyser = newAudioContext.createAnalyser();

      newAnalyser.fftSize = 512;
      const newDataArray = new Uint8Array(newAnalyser.frequencyBinCount);

      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          const source = newAudioContext.createMediaStreamSource(stream);
          source.connect(newAnalyser);

          setAudioContext(newAudioContext);
          setAnalyser(newAnalyser);
          setDataArray(newDataArray);
          setIsMicrophoneActive(true);
        })
        .catch((err) => {
          console.error('Microphone access error:', err);
          alert('Microphone access failed. Please check permissions.');
        });
    } catch (error) {
      console.error('Audio context creation error:', error);
      alert('Web Audio API is not supported in this browser.');
    }
  };

  // 6) Container Style with Radial Gradient
  const containerStyle = {
    height: '100vh',
    width: '100%',
    cursor: 'pointer',
    // Radial gradient from the center: from dark-blue to near-black
    background: 'radial-gradient(circle at center,rgb(12, 25, 97) 0%, #000000 70%)',
    overflow: 'hidden',
    position: 'relative',
  };

  return (
    <div
      ref={sceneRef}
      style={containerStyle}
      onClick={startAudioProcessing}
    ></div>
  );
};

export default SphereAnimation;