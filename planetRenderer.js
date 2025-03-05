import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Class to handle planet rendering
export class PlanetRenderer {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.options = {
      size: options.size || 2,
      rotationSpeed: options.rotationSpeed || 0.001,
      autoRotate: options.autoRotate !== undefined ? options.autoRotate : true
    };
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.planet = null;
    this.controls = null;
    this.animationId = null;
    this.textureLoader = new THREE.TextureLoader();
    this.corsProxyUrl = 'https://cors-anywhere.herokuapp.com/';
    
    this.init();
  }
  
  init() {
    if (!this.container) {
      console.error(`Container with id ${this.containerId} not found`);
      return;
    }
    
    // Get container dimensions
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    // Create scene
    this.scene = new THREE.Scene();
    
    // Create camera
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 5;
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);
    
    // Create default planet
    this.createDefaultPlanet();
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 1);
    this.scene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    this.scene.add(directionalLight);
    
    // Add controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.5;
    this.controls.autoRotate = this.options.autoRotate;
    this.controls.autoRotateSpeed = 1.0;
    
    // Add stars
    this.addStars();
    
    // Start animation loop
    this.animate();
    
    // Handle resize
    window.addEventListener('resize', () => {
      this.handleResize();
    });
  }
  
  createDefaultPlanet() {
    // Create a sphere geometry
    const geometry = new THREE.SphereGeometry(this.options.size, 64, 64);
    
    // Create a basic material
    const material = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      roughness: 0.7,
      metalness: 0.2
    });
    
    // Create the planet mesh
    this.planet = new THREE.Mesh(geometry, material);
    this.scene.add(this.planet);
  }
  
  addStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1
    });
    
    const starVertices = [];
    for (let i = 0; i < 1000; i++) {
      const x = (Math.random() - 0.5) * 100;
      const y = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;
      starVertices.push(x, y, z);
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(stars);
  }
  
  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    // Rotate planet
    if (this.planet && !this.options.autoRotate) {
      this.planet.rotation.y += this.options.rotationSpeed;
    }
    
    // Update controls
    this.controls.update();
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  handleResize() {
    if (!this.container) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  async setTexture(textureUrl) {
    return new Promise((resolve, reject) => {
      if (!this.planet) {
        reject('Planet not initialized');
        return;
      }
      
      const handleTextureLoad = (texture) => {
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.7,
          metalness: 0.2
        });
        this.planet.material = material;
        resolve('Texture applied successfully');
      };
      
      const handleTextureError = (err) => {
        console.warn('Error loading texture, trying with CORS proxy:', err);
        
        // Try with CORS proxy
        this.textureLoader.load(
          this.corsProxyUrl + textureUrl,
          handleTextureLoad,
          undefined,
          (proxyErr) => {
            console.error('Failed to load texture even with proxy:', proxyErr);
            reject(proxyErr);
          }
        );
      };
      
      // Try loading texture directly first
      this.textureLoader.load(
        textureUrl,
        handleTextureLoad,
        undefined,
        handleTextureError
      );
    });
  }
  
  cleanup() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    // Remove event listeners
    window.removeEventListener('resize', this.handleResize);
    
    // Remove renderer from DOM
    if (this.renderer && this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    
    // Dispose of THREE.js resources
    if (this.planet) {
      this.planet.geometry.dispose();
      this.planet.material.dispose();
      this.scene.remove(this.planet);
    }
    
    this.controls.dispose();
    this.renderer.dispose();
  }
}

// Make PlanetRenderer available globally
window.PlanetRenderer = PlanetRenderer;

