import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const AnalyzingAnimation = () => {
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const scene = new THREE.Scene();
    // Remove or comment out the line setting background color:
    // scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // Enable alpha for transparency
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Ensure the renderer is fully transparent
    renderer.setClearAlpha(0);

    rendererRef.current = renderer;

    if (sceneRef.current) {
      while (sceneRef.current.firstChild) {
        sceneRef.current.removeChild(sceneRef.current.firstChild);
      }
      sceneRef.current.appendChild(renderer.domElement);
    }

    const radius = 0.7;
    const numDots = 70;
    const sphereSize = 0.03;
    const dots = [];
    const originalPositions = [];

    const neonColors = [
      0x00ff00, // Bright Green
      0x0000ff, // Bright Blue
      0xff00ff, // Magenta
      0x00ffff, // Cyan
      0xffff00, // Yellow
    ];

    // Create dots in a spherical arrangement
    for (let i = 0; i < numDots; i++) {
      const phi = Math.acos(-1 + (2 * i) / numDots);
      const theta = Math.sqrt(numDots * Math.PI) * phi;

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

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1, 10);
    pointLight.position.set(2, 2, 2);
    scene.add(pointLight);

    let time = 0;
    let phase = 0; // 0: first contraction, 1: pause, 2: second contraction, 3: expansion
    let contractionFactor = 1;
    const pauseDurations = [0.05, 0.15]; // Adjust for rhythm

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      if (phase === 0) {
        // First contraction
        contractionFactor -= 0.006;
        if (contractionFactor <= 0.9) {
          contractionFactor = 0.9;
          time = 0;
          phase = 1;
        }
      } else if (phase === 1) {
        // Pause
        time += 0.015;
        if (time >= pauseDurations[0]) {
          phase = 2;
          time = 0;
        }
      } else if (phase === 2) {
        // Second contraction
        contractionFactor -= 0.007;
        if (contractionFactor <= 0.8) {
          contractionFactor = 0.8;
          time = 0;
          phase = 3;
        }
      } else if (phase === 3) {
        // Expansion
        contractionFactor += 0.01;
        if (contractionFactor >= 1) {
          contractionFactor = 1;
          phase = 0;
        }
      }

      // Update positions
      for (let i = 0; i < dots.length; i++) {
        const { x, y, z } = originalPositions[i];
        dots[i].position.set(x * contractionFactor, y * contractionFactor, z * contractionFactor);
      }

      renderer.render(scene, camera);
    };

    camera.position.z = 3;

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current) rendererRef.current.dispose();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      dots.forEach((dot) => {
        scene.remove(dot);
        dot.geometry.dispose();
        dot.material.dispose();
      });
    };
  }, []);

  // Apply a radial gradient behind the transparent canvas
  const containerStyle = {
    position: 'relative',
    width: '100%',
    height: '100vh',
    // Radial gradient from the center
    background: 'radial-gradient(circle at center,rgb(12, 25, 97) 0%, #000000 70%)',
    overflow: 'hidden',
  };

  return <div ref={sceneRef} style={containerStyle}></div>;
};

export default AnalyzingAnimation;