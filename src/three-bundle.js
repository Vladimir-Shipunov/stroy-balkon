/**
 * Three.js global bundle — exposes window.THREE with all extras.
 * Built by Vite into public/vendor/three-bundle/three.global.js
 */
import * as _THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Create a mutable plain object — namespace exports are read-only
const THREE = Object.assign(Object.create(null), _THREE);
THREE.OrbitControls = OrbitControls;
THREE.RoomEnvironment = RoomEnvironment;
THREE.GLTFLoader = GLTFLoader;
THREE.DRACOLoader = DRACOLoader;

window.THREE = THREE;
