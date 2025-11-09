// main.js
// Main application file - initializes Three.js scene and manages the simulation

class FluidSimulator {
    constructor() {
        // Simulation parameters
        this.params = {
            numParticles: 2000,  // Reduced for CPU performance
            particleMass: 1.0,
            restDensity: 1000.0,
            smoothingRadius: 0.5,
            stiffness: 2000.0,
            viscosity: 0.3,
            fluidGravity: -9.8,  // Constant gravity for fluid particles
            timeStep: 0.003,
            damping: 0.6,
            particleSize: 0.2,  // Increased for visibility
            boundMin: new THREE.Vector3(-8, -5, -8),
            boundMax: new THREE.Vector3(8, 12, 8),
            simulationSpeed: 1.0,  // Speed multiplier (0.1 to 5.0)
            fluidColor: '#ffffff'  // Default white color
        };
        
        // Object parameters (separate from fluid)
        this.objectParams = {
            gravity: -9.8,
            scale: 1.0,
            rotationX: 0,  // X-axis rotation (Pitch) in degrees (-720 to 720)
            rotationY: 0,  // Y-axis rotation (Yaw) in degrees (-720 to 720)
            rotationZ: 0,  // Z-axis rotation (Roll) in degrees (-720 to 720)
            density: 2700  // Default density (aluminum: 2700 kg/m³)
        };
        
        this.paused = false;
        this.rigidBodies = [];
        this.selectedObjectIndex = 'all'; // Track which object to apply params to
        this.objectCounter = 0; // Counter for unique object IDs
        this.stats = {
            fps: 60,
            computeTime: 0,
            renderTime: 0
        };
        
        // Load custom presets from localStorage
        this.customPresets = this.loadCustomPresets();
        
        this.init();
        this.setupUI();
        this.animate();
    }
    
    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        this.scene.fog = new THREE.Fog(0x0a0a0a, 20, 50);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(15, 10, 15);
        this.camera.lookAt(0, 3, 0);
        
        // Renderer
        this.canvas = document.getElementById('canvas');
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Check WebGL support
        const gl = this.renderer.getContext();
        console.log('✓ WebGL context created');
        console.log('Using CPU-based SPH simulation (compatible with all browsers)');
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        const pointLight1 = new THREE.PointLight(0x4fc3f7, 0.5);
        pointLight1.position.set(-10, 5, -10);
        this.scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0x81c784, 0.5);
        pointLight2.position.set(10, 5, 10);
        this.scene.add(pointLight2);
        
        // Create boundary box
        this.createBoundaryBox();
        
        // Create ground
        this.createGround();
        
        // Initialize particle system
        this.particleSystem = new ParticleSystem(this.params.numParticles, this.params);
        this.scene.add(this.particleSystem.particles);
        
        console.log('✓ Particle system ready');
        
        // Mouse controls
        this.setupControls();
        
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // FPS tracking
        this.lastTime = performance.now();
        this.frameCount = 0;
    }
    
    createBoundaryBox() {
        const size = this.params.boundMax.clone().sub(this.params.boundMin);
        const center = this.params.boundMin.clone().add(size.clone().multiplyScalar(0.5));
        
        // Wireframe box
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x4fc3f7,
            transparent: true,
            opacity: 0.3,
            linewidth: 2
        });
        
        this.boundaryBox = new THREE.LineSegments(edges, lineMaterial);
        this.boundaryBox.position.copy(center);
        this.scene.add(this.boundaryBox);
        
        // Glass-like panels for walls
        const panelMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x4fc3f7,
            transparent: true,
            opacity: 0.05,
            metalness: 0.1,
            roughness: 0.1,
            side: THREE.DoubleSide
        });
        
        // Bottom panel (more visible)
        const bottomGeometry = new THREE.PlaneGeometry(size.x, size.z);
        const bottomPanel = new THREE.Mesh(bottomGeometry, panelMaterial.clone());
        bottomPanel.material.opacity = 0.15;
        bottomPanel.rotation.x = -Math.PI / 2;
        bottomPanel.position.set(center.x, this.params.boundMin.y, center.z);
        this.scene.add(bottomPanel);
    }
    
    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.8,
            metalness: 0.2
        });
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = this.params.boundMin.y - 0.1;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Grid helper
        const gridHelper = new THREE.GridHelper(40, 40, 0x333333, 0x1a1a1a);
        gridHelper.position.y = this.params.boundMin.y - 0.05;
        this.scene.add(gridHelper);
    }
    
    setupControls() {
        // Simple orbit controls (manual implementation)
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.cameraRotation = { theta: Math.PI / 4, phi: Math.PI / 6 };
        this.cameraDistance = 25;
        
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const deltaX = e.clientX - this.previousMousePosition.x;
                const deltaY = e.clientY - this.previousMousePosition.y;
                
                this.cameraRotation.theta -= deltaX * 0.005;
                this.cameraRotation.phi -= deltaY * 0.005;
                
                // Clamp phi
                this.cameraRotation.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraRotation.phi));
                
                this.updateCameraPosition();
                
                this.previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
        
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.cameraDistance += e.deltaY * 0.01;
            this.cameraDistance = Math.max(5, Math.min(50, this.cameraDistance));
            this.updateCameraPosition();
        });
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.key === 'h' || e.key === 'H') {
                this.toggleUI();
            }
            if (e.key === ' ') {
                this.togglePause();
            }
        });
    }
    
    updateCameraPosition() {
        const x = this.cameraDistance * Math.sin(this.cameraRotation.phi) * Math.cos(this.cameraRotation.theta);
        const y = this.cameraDistance * Math.cos(this.cameraRotation.phi);
        const z = this.cameraDistance * Math.sin(this.cameraRotation.phi) * Math.sin(this.cameraRotation.theta);
        
        this.camera.position.set(x, y + 3, z);
        this.camera.lookAt(0, 3, 0);
    }
    
    setupUI() {
        // Fluid parameter sliders (removed gravity - it's constant at -9.8)
        const sliders = [
            { id: 'particles', param: 'numParticles', display: 'val-particles' },
            { id: 'density', param: 'restDensity', display: 'val-density' },
            { id: 'stiffness', param: 'stiffness', display: 'val-stiffness' },
            { id: 'viscosity', param: 'viscosity', display: 'val-viscosity' },
            { id: 'timestep', param: 'timeStep', display: 'val-timestep' },
            { id: 'size', param: 'particleSize', display: 'val-size' },
            { id: 'sim-speed', param: 'simulationSpeed', display: 'val-sim-speed' }
        ];
        
        sliders.forEach(slider => {
            const sliderElement = document.getElementById(`slider-${slider.id}`);
            const inputElement = document.getElementById(`input-${slider.id}`);
            const display = document.getElementById(slider.display);
            
            // Slider change updates param, display, and input
            sliderElement.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.params[slider.param] = value;
                display.textContent = value;
                inputElement.value = value;
            });
            
            // Input change updates param, display, and slider
            inputElement.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                    this.params[slider.param] = value;
                    display.textContent = value;
                    sliderElement.value = value;
                }
            });
        });
        
        // Object parameter sliders
        const objectSliders = [
            { id: 'object-gravity', param: 'gravity', display: 'val-object-gravity' },
            { id: 'object-scale', param: 'scale', display: 'val-object-scale' },
            { id: 'object-rotation-x', param: 'rotationX', display: 'val-object-rotation-x' },
            { id: 'object-rotation-y', param: 'rotationY', display: 'val-object-rotation-y' },
            { id: 'object-rotation-z', param: 'rotationZ', display: 'val-object-rotation-z' },
            { id: 'object-density', param: 'density', display: 'val-object-density' }
        ];
        
        objectSliders.forEach(slider => {
            const sliderElement = document.getElementById(`slider-${slider.id}`);
            const inputElement = document.getElementById(`input-${slider.id}`);
            const display = document.getElementById(slider.display);
            
            // Slider change
            sliderElement.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.objectParams[slider.param] = value;
                display.textContent = value;
                inputElement.value = value;
                
                // Apply changes to selected object(s)
                this.applyParamToSelectedObject(slider.param, value);
            });
            
            // Input change
            inputElement.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                    this.objectParams[slider.param] = value;
                    display.textContent = value;
                    sliderElement.value = value;
                    
                    // Apply changes to selected object(s)
                    this.applyParamToSelectedObject(slider.param, value);
                }
            });
        });
        
        // Target object selector
        document.getElementById('select-target-object').addEventListener('change', (e) => {
            this.selectedObjectIndex = e.target.value;
            console.log(`Selected target: ${this.selectedObjectIndex}`);
        });
        
        // Main action buttons
        document.getElementById('btn-reset').addEventListener('click', () => this.reset());
        document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
        
        // Menu toggle buttons - open side panels
        document.getElementById('btn-objects').addEventListener('click', () => this.openSidePanel('objects'));
        document.getElementById('btn-fluids').addEventListener('click', () => this.openSidePanel('fluids'));
        
        // Object buttons (in side panel)
        document.getElementById('btn-drop-sphere').addEventListener('click', () => this.dropRigidBody('sphere'));
        document.getElementById('btn-drop-cube').addEventListener('click', () => this.dropRigidBody('cube'));
        document.getElementById('btn-drop-cylinder').addEventListener('click', () => this.dropRigidBody('cylinder'));
        document.getElementById('btn-drop-torus').addEventListener('click', () => this.dropRigidBody('torus'));
        document.getElementById('btn-drop-cone').addEventListener('click', () => this.dropRigidBody('cone'));
        document.getElementById('btn-drop-boat').addEventListener('click', () => this.dropRigidBody('boat'));
        document.getElementById('btn-drop-hollow-sphere').addEventListener('click', () => this.dropRigidBody('hollow-sphere'));
        document.getElementById('btn-drop-hollow-cube').addEventListener('click', () => this.dropRigidBody('hollow-cube'));
        document.getElementById('btn-drop-hollow-cylinder').addEventListener('click', () => this.dropRigidBody('hollow-cylinder'));
        document.getElementById('btn-clear-objects').addEventListener('click', () => this.clearAllObjects());
        
        // Density preset dropdown
        document.getElementById('select-density-preset').addEventListener('change', (e) => {
            const density = parseInt(e.target.value);
            this.setDensity(density);
        });
        
        // Fluid preset buttons (in side panel)
        document.getElementById('btn-fluid-water').addEventListener('click', () => this.applyFluidPreset('water'));
        document.getElementById('btn-fluid-honey').addEventListener('click', () => this.applyFluidPreset('honey'));
        document.getElementById('btn-fluid-oil').addEventListener('click', () => this.applyFluidPreset('oil'));
        document.getElementById('btn-fluid-mercury').addEventListener('click', () => this.applyFluidPreset('mercury'));
        document.getElementById('btn-fluid-air').addEventListener('click', () => this.applyFluidPreset('air'));
        document.getElementById('btn-fluid-gel').addEventListener('click', () => this.applyFluidPreset('gel'));
        document.getElementById('btn-fluid-custom').addEventListener('click', () => this.applyFluidPreset('custom'));
        
        // Save preset button (in fluid presets panel)
        document.getElementById('btn-save-preset').addEventListener('click', () => this.openSavePresetModal());
        
        // Color picker for fluid
        document.getElementById('input-fluid-color').addEventListener('input', (e) => {
            this.params.fluidColor = e.target.value;
            this.updateFluidColor();
        });
        
        // Make panel functions globally accessible for inline onclick handlers
        window.openSidePanel = (panelName) => this.openSidePanel(panelName);
        window.closeSidePanel = (panelName) => this.closeSidePanel(panelName);
        
        // Make modal functions globally accessible
        window.closeSavePresetModal = () => this.closeSavePresetModal();
        window.confirmSavePreset = () => this.confirmSavePreset();
        window.closePresetExistsModal = () => this.closePresetExistsModal();
        window.overwritePreset = () => this.overwritePreset();
        window.createNewPresetWithSameName = () => this.createNewPresetWithSameName();
        
        // Save preset button
        document.getElementById('btn-save-sample').addEventListener('click', () => this.openSavePresetModal());
        
        // Enter key support for preset name input
        document.getElementById('preset-name-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.confirmSavePreset();
            }
        });
        
        // UI toggle
        document.getElementById('toggle-ui').addEventListener('click', () => this.toggleUI());
        
        // Load and display custom presets
        this.updateCustomPresetsUI();
    }
    
    toggleMenu(menuId, buttonId) {
        const menu = document.getElementById(menuId);
        const button = document.getElementById(buttonId);
        const isVisible = menu.style.display !== 'none';
        
        menu.style.display = isVisible ? 'none' : 'block';
        button.textContent = isVisible ? '▼ ' + button.textContent.substring(2) : '▲ ' + button.textContent.substring(2);
    }
    
    reset() {
        // Remove all rigid bodies
        this.rigidBodies.forEach(body => body.remove());
        this.rigidBodies = [];
        
        // Clear object dropdown (keep only "All Objects")
        const dropdown = document.getElementById('select-target-object');
        dropdown.innerHTML = '<option value="all">🌐 All Objects (Default)</option>';
        this.selectedObjectIndex = 'all';
        this.objectCounter = 0;
        
        // Remove old particle system from scene
        if (this.particleSystem && this.particleSystem.particles) {
            this.scene.remove(this.particleSystem.particles);
            this.particleSystem.particles.geometry.dispose();
            this.particleSystem.particles.material.dispose();
        }
        
        // Create new particle system
        this.particleSystem = new ParticleSystem(this.params.numParticles, this.params);
        this.scene.add(this.particleSystem.particles);
        
        // Unpause if paused
        if (this.paused) {
            this.togglePause();
        }
        
        console.log('✓ Simulation completely reset and restarted');
    }
    
    dropRigidBody(type) {
        const position = new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            10,
            (Math.random() - 0.5) * 4
        );
        
        let size;
        switch(type) {
            case 'sphere':
                size = new THREE.Vector3(0.8, 0.8, 0.8);
                break;
            case 'cube':
                size = new THREE.Vector3(1.5, 1.5, 1.5);
                break;
            case 'cylinder':
                size = new THREE.Vector3(0.6, 1.5, 0.6);
                break;
            case 'torus':
                size = new THREE.Vector3(0.8, 0.3, 0.3);
                break;
            case 'cone':
                size = new THREE.Vector3(0.8, 1.5, 0.8);
                break;
            case 'boat':
                size = new THREE.Vector3(2.5, 0.6, 1.2);
                break;
            case 'hollow-sphere':
                size = new THREE.Vector3(1.0, 1.0, 1.0);
                break;
            case 'hollow-cube':
                size = new THREE.Vector3(1.5, 1.5, 1.5);
                break;
            case 'hollow-cylinder':
                size = new THREE.Vector3(0.7, 1.5, 0.7);
                break;
            default:
                size = new THREE.Vector3(1.0, 1.0, 1.0);
        }
        
        // Create rigid body with current object parameters
        console.log('Object params:', {
            scale: this.objectParams.scale,
            rotationX: this.objectParams.rotationX,
            rotationY: this.objectParams.rotationY,
            rotationZ: this.objectParams.rotationZ,
            density: this.objectParams.density
        });
        
        const body = new RigidBody(
            type, 
            position, 
            size, 
            this.scene, 
            this.objectParams.scale || 1.0, 
            this.objectParams.rotationX || 0,
            this.objectParams.rotationY || 0,
            this.objectParams.rotationZ || 0,
            this.objectParams.density || 2700
        );
        
        // Assign unique ID to the object
        this.objectCounter++;
        body.id = this.objectCounter;
        
        // Get emoji for object type
        const emojiMap = {
            'sphere': '⚪',
            'cube': '🟦',
            'cylinder': '🔵',
            'torus': '🍩',
            'cone': '🔺',
            'boat': '⛵',
            'hollow-sphere': '⭕',
            'hollow-cube': '⬜',
            'hollow-cylinder': '⚙️'
        };
        const emoji = emojiMap[type] || '📦';
        body.displayName = `${emoji} ${type.charAt(0).toUpperCase() + type.slice(1)} #${this.objectCounter}`;
        
        this.rigidBodies.push(body);
        
        // Add to dropdown
        this.addObjectToDropdown(body);
        
        console.log(`Dropped ${type} at`, position);
        this.closeSidePanel('objects');
    }
    
    addObjectToDropdown(body) {
        const dropdown = document.getElementById('select-target-object');
        const option = document.createElement('option');
        option.value = body.id;
        option.textContent = `${body.displayName}`;
        dropdown.appendChild(option);
    }
    
    removeObjectFromDropdown(bodyId) {
        const dropdown = document.getElementById('select-target-object');
        const option = dropdown.querySelector(`option[value="${bodyId}"]`);
        if (option) {
            option.remove();
        }
    }
    
    applyParamToSelectedObject(param, value) {
        if (this.selectedObjectIndex === 'all') {
            // Apply to all objects
            this.rigidBodies.forEach(body => {
                this.applySingleParam(body, param, value);
            });
        } else {
            // Apply to specific object
            const body = this.rigidBodies.find(b => b.id == this.selectedObjectIndex);
            if (body) {
                this.applySingleParam(body, param, value);
            }
        }
    }
    
    applySingleParam(body, param, value) {
        if (param === 'scale') {
            body.setScale(value);
        } else if (param === 'rotationX' || param === 'rotationY' || param === 'rotationZ') {
            body.setRotation(this.objectParams.rotationX, this.objectParams.rotationY, this.objectParams.rotationZ);
        } else if (param === 'density') {
            body.density = value;
        } else if (param === 'gravity') {
            // Gravity is applied in the update loop, no need to set directly
        }
    }
    
    clearObjects() {
        this.rigidBodies.forEach(body => body.remove());
        this.rigidBodies = [];
        
        // Clear dropdown (keep only "All Objects")
        const dropdown = document.getElementById('select-target-object');
        dropdown.innerHTML = '<option value="all">🌐 All Objects (Default)</option>';
        this.selectedObjectIndex = 'all';
        
        console.log('✓ All objects cleared');
        this.closeSidePanel('objects');
    }
    
    clearAllObjects() {
        this.clearObjects();
    }
    
    openSidePanel(panelName) {
        const panel = document.getElementById(`${panelName}-panel`);
        if (panel) {
            panel.classList.add('active');
        }
    }
    
    closeSidePanel(panelName) {
        const panel = document.getElementById(`${panelName}-panel`);
        if (panel) {
            panel.classList.remove('active');
        }
    }
    
    applyFluidPreset(presetName) {
        const presets = {
            water: {
                restDensity: 1000,
                stiffness: 2000,
                viscosity: 0.3,
                name: '💧 Water',
                color: '#4fc3f7'
            },
            honey: {
                restDensity: 1400,
                stiffness: 3000,
                viscosity: 0.85,
                name: '🍯 Honey',
                color: '#ffb74d'
            },
            oil: {
                restDensity: 900,
                stiffness: 1800,
                viscosity: 0.5,
                name: '🛢️ Oil',
                color: '#8d6e63'
            },
            mercury: {
                restDensity: 13600,
                stiffness: 5000,
                viscosity: 0.15,
                name: '⚗️ Mercury',
                color: '#90a4ae'
            },
            air: {
                restDensity: 1.2,
                stiffness: 100,
                viscosity: 0.01,
                name: '💨 Air',
                color: '#e0f7fa'
            },
            gel: {
                restDensity: 1100,
                stiffness: 2500,
                viscosity: 0.95,
                name: '🧴 Gel',
                color: '#81c784'
            },
            custom: {
                name: '⚙️ Custom',
                color: '#ffffff'
            }
        };
        
        const preset = presets[presetName];
        if (!preset) return;
        
        if (presetName !== 'custom') {
            // Apply preset values (gravity stays constant for fluids)
            this.params.restDensity = preset.restDensity;
            this.params.stiffness = preset.stiffness;
            this.params.viscosity = preset.viscosity;
            
            // Update UI sliders
            document.getElementById('slider-density').value = preset.restDensity;
            document.getElementById('val-density').textContent = preset.restDensity;
            
            document.getElementById('slider-stiffness').value = preset.stiffness;
            document.getElementById('val-stiffness').textContent = preset.stiffness;
            
            document.getElementById('slider-viscosity').value = preset.viscosity;
            document.getElementById('val-viscosity').textContent = preset.viscosity;
            
            console.log(`✓ Applied ${preset.name} preset`);
        }
        
        // Apply color for all presets (including custom)
        if (preset.color) {
            this.params.fluidColor = preset.color;
            document.getElementById('input-fluid-color').value = preset.color;
            this.updateFluidColor();
        }
        
        this.closeSidePanel('fluids');
    }
    
    updateFluidColor() {
        if (this.particleSystem && this.particleSystem.particleMaterial) {
            const color = new THREE.Color(this.params.fluidColor);
            this.particleSystem.particleMaterial.color = color;
        }
    }
    
    setDensity(density) {
        this.objectParams.density = density;
        document.getElementById('slider-object-density').value = density;
        document.getElementById('input-object-density').value = density;
        document.getElementById('val-object-density').textContent = density;
        
        // Update dropdown if it matches a preset value
        const dropdown = document.getElementById('select-density-preset');
        if (dropdown.querySelector(`option[value="${density}"]`)) {
            dropdown.value = density;
        }
        
        // Update all existing objects
        this.rigidBodies.forEach(body => {
            body.density = density;
        });
        
        console.log(`Set object density to ${density} kg/m³`);
    }
    
    togglePause() {
        this.paused = !this.paused;
        const btn = document.getElementById('btn-pause');
        btn.textContent = this.paused ? '▶ Resume' : '⏸ Pause';
    }
    
    toggleUI() {
        const panel = document.getElementById('ui-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
    
    updateStats() {
        this.frameCount++;
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        
        if (deltaTime >= 1000) {
            this.stats.fps = Math.round(this.frameCount * 1000 / deltaTime);
            this.frameCount = 0;
            this.lastTime = currentTime;
            
            document.getElementById('fps').textContent = this.stats.fps;
            document.getElementById('particle-count').textContent = this.params.numParticles;
            document.getElementById('body-count').textContent = this.rigidBodies.length;
            document.getElementById('compute-time').textContent = this.stats.computeTime.toFixed(2) + 'ms';
            document.getElementById('render-time').textContent = this.stats.renderTime.toFixed(2) + 'ms';
        }
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (!this.paused && this.particleSystem) {
            // Apply simulation speed multiplier
            const speedMultiplier = this.params.simulationSpeed;
            
            // Update rigid bodies with speed multiplier
            this.rigidBodies.forEach(body => {
                body.update(
                    this.params.timeStep * speedMultiplier,
                    this.objectParams.gravity,
                    this.params.boundMin,
                    this.params.boundMax,
                    this.params.damping,
                    this.params.restDensity,  // Pass fluid density for buoyancy calculation
                    this.rigidBodies  // Pass all rigid bodies for object-to-object collision
                );
            });
            
            // Additional collision resolution passes to prevent tunneling
            for (let i = 0; i < 3; i++) {
                this.rigidBodies.forEach(body => {
                    body.checkObjectCollisions(this.rigidBodies);
                });
            }
            
            // Temporarily scale timeStep for particle system
            const originalTimeStep = this.params.timeStep;
            this.params.timeStep *= speedMultiplier;
            
            // Update particle system
            try {
                this.stats.computeTime = this.particleSystem.update(this.renderer, this.rigidBodies);
            } catch (error) {
                console.error('Simulation error:', error);
                this.paused = true;
            }
            
            // Restore original timeStep
            this.params.timeStep = originalTimeStep;
        }
        
        // Render scene
        const renderStart = performance.now();
        this.renderer.render(this.scene, this.camera);
        this.stats.renderTime = performance.now() - renderStart;
        
        this.updateStats();
    }

    // Custom Preset Management
    loadCustomPresets() {
        try {
            const saved = localStorage.getItem('fluidSimulatorCustomPresets');
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('Error loading custom presets:', error);
            return {};
        }
    }

    saveCustomPresets() {
        try {
            localStorage.setItem('fluidSimulatorCustomPresets', JSON.stringify(this.customPresets));
        } catch (error) {
            console.error('Error saving custom presets:', error);
        }
    }

    openSavePresetModal() {
        // Update modal with current parameters (no gravity - it's constant)
        document.getElementById('modal-particles').textContent = this.params.numParticles;
        document.getElementById('modal-density').textContent = this.params.restDensity;
        document.getElementById('modal-stiffness').textContent = this.params.stiffness;
        document.getElementById('modal-viscosity').textContent = this.params.viscosity;
        document.getElementById('modal-timestep').textContent = this.params.timeStep;
        
        // Clear input field
        document.getElementById('preset-name-input').value = '';
        
        // Show modal
        document.getElementById('save-preset-modal').classList.add('active');
        document.getElementById('preset-name-input').focus();
    }

    closeSavePresetModal() {
        document.getElementById('save-preset-modal').classList.remove('active');
    }

    confirmSavePreset() {
        const nameInput = document.getElementById('preset-name-input');
        const presetName = nameInput.value.trim();
        
        if (!presetName) {
            alert('⚠️ Please enter a name for your preset!');
            return;
        }
        
        // Check if preset already exists (case-insensitive)
        const presetKey = presetName.toLowerCase();
        
        // List of standard preset names
        const standardPresets = ['water', 'honey', 'oil', 'mercury', 'air', 'gel', 'custom'];
        const isStandardPreset = standardPresets.includes(presetKey);
        const isCustomPreset = this.customPresets[presetKey];
        
        if (isStandardPreset || isCustomPreset) {
            // Show "already exists" modal with appropriate options
            const displayName = isCustomPreset ? this.customPresets[presetKey].displayName : presetName;
            document.getElementById('existing-preset-name').textContent = displayName;
            document.getElementById('existing-preset-type').textContent = isStandardPreset ? 'standard' : 'custom';
            
            // Show/hide overwrite button based on preset type
            const overwriteBtn = document.getElementById('btn-overwrite-preset');
            if (isStandardPreset) {
                overwriteBtn.style.display = 'none';
                document.getElementById('btn-create-new-preset').style.width = '100%';
            } else {
                overwriteBtn.style.display = 'block';
                document.getElementById('btn-create-new-preset').style.width = '';
            }
            
            document.getElementById('preset-exists-modal').classList.add('active');
            return;
        }
        
        // Save the preset
        this.customPresets[presetKey] = {
            displayName: presetName,
            params: {
                numParticles: this.params.numParticles,
                restDensity: this.params.restDensity,
                stiffness: this.params.stiffness,
                viscosity: this.params.viscosity,
                timeStep: this.params.timeStep,
                fluidColor: this.params.fluidColor
            }
        };
        
        this.saveCustomPresets();
        this.updateCustomPresetsUI();
        this.closeSavePresetModal();
        
        console.log(`✅ Preset "${presetName}" saved successfully!`);
    }
    
    closePresetExistsModal() {
        document.getElementById('preset-exists-modal').classList.remove('active');
    }
    
    createNewPresetWithSameName() {
        const nameInput = document.getElementById('preset-name-input');
        const originalName = nameInput.value.trim();
        const presetKey = originalName.toLowerCase();
        
        // Generate a new unique name by appending a number
        let counter = 1;
        let newName = `${originalName} (${counter})`;
        let newKey = newName.toLowerCase();
        
        const standardPresets = ['water', 'honey', 'oil', 'mercury', 'air', 'gel', 'custom'];
        
        while (standardPresets.includes(newKey) || this.customPresets[newKey]) {
            counter++;
            newName = `${originalName} (${counter})`;
            newKey = newName.toLowerCase();
        }
        
        // Save the new preset with unique name
        this.customPresets[newKey] = {
            displayName: newName,
            params: {
                numParticles: this.params.numParticles,
                restDensity: this.params.restDensity,
                stiffness: this.params.stiffness,
                viscosity: this.params.viscosity,
                timeStep: this.params.timeStep,
                fluidColor: this.params.fluidColor
            }
        };
        
        this.saveCustomPresets();
        this.updateCustomPresetsUI();
        this.closePresetExistsModal();
        this.closeSavePresetModal();
        
        console.log(`✅ New preset "${newName}" created successfully!`);
    }
    
    overwritePreset() {
        const nameInput = document.getElementById('preset-name-input');
        const presetName = nameInput.value.trim();
        const presetKey = presetName.toLowerCase();
        
        // Overwrite the existing preset
        this.customPresets[presetKey] = {
            displayName: presetName,
            params: {
                numParticles: this.params.numParticles,
                restDensity: this.params.restDensity,
                stiffness: this.params.stiffness,
                viscosity: this.params.viscosity,
                timeStep: this.params.timeStep,
                fluidColor: this.params.fluidColor
            }
        };
        
        this.saveCustomPresets();
        this.updateCustomPresetsUI();
        this.closePresetExistsModal();
        this.closeSavePresetModal();
        
        console.log(`✅ Preset "${presetName}" overwritten successfully!`);
    }

    updateCustomPresetsUI() {
        const container = document.getElementById('custom-presets-container');
        
        if (Object.keys(this.customPresets).length === 0) {
            container.innerHTML = '<div style="color: #888; font-size: 11px; font-style: italic;">No custom presets saved yet</div>';
            return;
        }
        
        container.innerHTML = '';
        
        Object.entries(this.customPresets).forEach(([key, preset]) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'custom-preset-item';
            wrapper.style.position = 'relative';
            wrapper.style.marginBottom = '8px';
            
            const button = document.createElement('button');
            button.textContent = `⭐ ${preset.displayName}`;
            button.onclick = () => this.applyCustomPreset(key);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-preset-btn';
            deleteBtn.textContent = '×';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteCustomPreset(key);
            };
            
            wrapper.appendChild(button);
            wrapper.appendChild(deleteBtn);
            container.appendChild(wrapper);
            
            // Add preset info
            const info = document.createElement('div');
            info.className = 'preset-info';
            info.textContent = `Density: ${preset.params.restDensity}, Viscosity: ${preset.params.viscosity}`;
            container.appendChild(info);
        });
    }

    applyCustomPreset(presetKey) {
        const preset = this.customPresets[presetKey];
        if (!preset) return;
        
        // Apply all parameters
        this.params.numParticles = preset.params.numParticles;
        this.params.restDensity = preset.params.restDensity;
        this.params.stiffness = preset.params.stiffness;
        this.params.viscosity = preset.params.viscosity;
        this.params.gravity = preset.params.gravity;
        this.params.timeStep = preset.params.timeStep;
        
        // Apply color if available
        if (preset.params.fluidColor) {
            this.params.fluidColor = preset.params.fluidColor;
            document.getElementById('input-fluid-color').value = preset.params.fluidColor;
            this.updateFluidColor();
        }
        
        // Update UI sliders
        document.getElementById('slider-particles').value = preset.params.numParticles;
        document.getElementById('val-particles').textContent = preset.params.numParticles;
        
        document.getElementById('slider-density').value = preset.params.restDensity;
        document.getElementById('val-density').textContent = preset.params.restDensity;
        
        document.getElementById('slider-stiffness').value = preset.params.stiffness;
        document.getElementById('val-stiffness').textContent = preset.params.stiffness;
        
        document.getElementById('slider-viscosity').value = preset.params.viscosity;
        document.getElementById('val-viscosity').textContent = preset.params.viscosity;
        
        document.getElementById('slider-gravity').value = preset.params.gravity;
        document.getElementById('val-gravity').textContent = preset.params.gravity;
        
        document.getElementById('slider-timestep').value = preset.params.timeStep;
        document.getElementById('val-timestep').textContent = preset.params.timeStep;
        
        console.log(`Applied custom preset: ${preset.displayName}`);
        this.closeSidePanel('fluids');
    }

    deleteCustomPreset(presetKey) {
        const preset = this.customPresets[presetKey];
        if (!preset) return;
        
        const confirmDelete = confirm(
            `🗑️ Are you sure you want to delete the preset "${preset.displayName}"?\n\n` +
            `This action cannot be undone.`
        );
        
        if (confirmDelete) {
            delete this.customPresets[presetKey];
            this.saveCustomPresets();
            this.updateCustomPresetsUI();
        }
    }
}

// Initialize the simulator when the page loads
window.addEventListener('DOMContentLoaded', () => {
    console.log('========================================');
    console.log('🌊 FLUID SIMULATOR STARTING...');
    console.log('========================================');
    
    try {
        const simulator = new FluidSimulator();
        window.simulator = simulator; // For debugging
        
        console.log('========================================');
        console.log('✓ SIMULATION READY!');
        console.log('Controls:');
        console.log('  - Click & drag to rotate camera');
        console.log('  - Scroll to zoom');
        console.log('  - Press H to toggle UI');
        console.log('  - Press Space to pause/resume');
        console.log('========================================');
    } catch (error) {
        console.error('========================================');
        console.error('❌ INITIALIZATION FAILED!');
        console.error('Error:', error);
        console.error('========================================');
        alert('Failed to initialize simulator. Check console for details.');
    }
});
