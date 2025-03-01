// Constants
const GRAVITY = 9.81; // m/s²
const STUMPS_DISTANCE = 22; // meters from release point (where batsman stands)
const BALL_RADIUS = 0.036; // meters
const COEFFICIENT_OF_RESTITUTION = 0.7; // Energy loss on bounce - increased for more noticeable effect
const WICKET_HEIGHT = 0.7112; // meters (28 inches)
const WICKET_WIDTH = 0.2286; // meters (9 inches)

// Get DOM elements
const canvas = document.getElementById('trajectoryCanvas');
const ctx = canvas.getContext('2d');
const releaseHeight1Input = document.getElementById('releaseHeight1');
const releaseHeight2Input = document.getElementById('releaseHeight2');
const ballSpeedInput = document.getElementById('ballSpeed');
const pitchDistanceInput = document.getElementById('pitchDistance');
const calculateBtn = document.getElementById('calculateBtn');
const resultsDiv = document.getElementById('results');

// Set canvas size
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}

// Initial resize
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Convert real-world coordinates to canvas coordinates
function worldToCanvas(x, y) {
    const scaleX = canvas.width / 25; // 25 meters width
    const scaleY = canvas.height / 5;  // 5 meters height
    return {
        x: x * scaleX,
        y: canvas.height - (y * scaleY) // Invert y-axis
    };
}

// Draw wickets
function drawWickets(x, color = '#333') {
    const wicketBase = worldToCanvas(x, 0);
    const wicketTop = worldToCanvas(x, WICKET_HEIGHT);
    
    // Draw three stumps
    const stumpWidth = 3;
    const stumpSpacing = 15;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = stumpWidth;
    
    // Left stump
    ctx.beginPath();
    ctx.moveTo(wicketBase.x - stumpSpacing, wicketBase.y);
    ctx.lineTo(wicketTop.x - stumpSpacing, wicketTop.y);
    ctx.stroke();
    
    // Middle stump
    ctx.beginPath();
    ctx.moveTo(wicketBase.x, wicketBase.y);
    ctx.lineTo(wicketTop.x, wicketTop.y);
    ctx.stroke();
    
    // Right stump
    ctx.beginPath();
    ctx.moveTo(wicketBase.x + stumpSpacing, wicketBase.y);
    ctx.lineTo(wicketTop.x + stumpSpacing, wicketTop.y);
    ctx.stroke();
    
    // Draw bails
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wicketTop.x - stumpSpacing - 5, wicketTop.y);
    ctx.lineTo(wicketTop.x + stumpSpacing + 5, wicketTop.y);
    ctx.stroke();
}

// Calculate trajectory points
function calculateTrajectory(releaseHeight, speed, pitchDistance) {
    const points = [];
    const dt = 0.01; // Time step in seconds
    
    // Initial conditions
    let x = 0;
    let y = releaseHeight;
    
    // Calculate time to reach pitch point
    const speedMS = speed * (1000/3600); // Convert km/h to m/s
    const timeToPitch = pitchDistance / speedMS;
    
    // Calculate initial vertical velocity to reach ground at pitch point using correct kinematic equation
    const initialVy = (0.5 * GRAVITY * timeToPitch) - (releaseHeight / timeToPitch);
    
    let currentVx = speedMS;
    let currentVy = initialVy;
    
    let isPitched = false;
    let pitchPoint = null;
    let lastPoint = null;
    let bouncePoint = null;
    let heightAtStumps = null;
    
    while (x <= STUMPS_DISTANCE + 1) { // Calculate until passing stumps
        lastPoint = {x, y, isPitched};
        
        // Update position using velocity
        const nextX = x + currentVx * dt;
        const nextY = y + currentVy * dt;
        
        // Check if ball has reached pitch point
        if (!isPitched && x < pitchDistance && nextX >= pitchDistance) {
            isPitched = true;
            pitchPoint = {
                x: pitchDistance,
                y: 0,
                isPitched: true
            };
            points.push(pitchPoint);
            
            // Calculate bounce velocity based on impact speed
            currentVy = Math.abs(currentVy) * COEFFICIENT_OF_RESTITUTION;
            x = pitchDistance;
            y = 0;
        } else {
            points.push(lastPoint);
            x = nextX;
            
            // Check for bounce after pitch
            if (isPitched && bouncePoint === null && nextY < 0) {
                // Calculate exact bounce time using quadratic formula
                const a = 0.5 * GRAVITY;
                const b = -currentVy;
                const c = -y;
                const discriminant = b*b - 4*a*c;
                
                if (discriminant >= 0) {
                    const t = (-b - Math.sqrt(discriminant)) / (2*a);
                    const dtBounce = t;
                    const bounceX = x + currentVx * dtBounce;
                    bouncePoint = {x: bounceX, y: 0, isPitched: true};
                    points.push(bouncePoint);
                    
                    // Update positions and velocity after bounce
                    x = bounceX;
                    y = 0;
                    currentVy = Math.abs(currentVy) * COEFFICIENT_OF_RESTITUTION;
                }
            } else {
                x = nextX;
                y = Math.max(0, nextY); // Don't let the ball go below ground
            }
            
            // Record height when ball passes stumps
            if (heightAtStumps === null && x >= STUMPS_DISTANCE) {
                // Interpolate height at exact stumps position
                const ratio = (STUMPS_DISTANCE - (x - currentVx * dt)) / (x - (x - currentVx * dt));
                heightAtStumps = y - (y - lastPoint.y) * (1 - ratio);
            }
            
            // Update vertical velocity due to gravity
            currentVy -= GRAVITY * dt;
        }
    }
    
    return {
        points,
        pitchPoint: pitchPoint,
        bouncePoint: bouncePoint,
        heightAtStumps: heightAtStumps
    };
}

// Draw both trajectories
function drawTrajectories(trajectory1, trajectory2, pitchDistance) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw ground
    ctx.beginPath();
    const ground = worldToCanvas(0, 0);
    ctx.moveTo(0, ground.y);
    ctx.lineTo(canvas.width, ground.y);
    ctx.strokeStyle = '#333';
    ctx.stroke();
    
    // Draw pitch area
    const pitchStart = worldToCanvas(0, 0);
    const pitchEnd = worldToCanvas(25, 0);
    ctx.fillStyle = '#e3d9c6'; // Light beige color for pitch
    ctx.fillRect(pitchStart.x, pitchStart.y - 5, pitchEnd.x - pitchStart.x, 5);
    
    // Draw wickets
    drawWickets(0); // Bowling end
    drawWickets(22); // Batting end
    
    // Draw grid lines (fainter)
    ctx.strokeStyle = '#eee';
    ctx.setLineDash([5, 5]);
    
    // Vertical grid lines every 5 meters
    for (let x = 0; x <= 25; x += 5) {
        ctx.beginPath();
        const gridPoint = worldToCanvas(x, 0);
        ctx.moveTo(gridPoint.x, 0);
        ctx.lineTo(gridPoint.x, canvas.height);
        ctx.stroke();
        
        // Add distance label
        ctx.fillStyle = '#666';
        ctx.fillText(`${x}m`, gridPoint.x + 5, canvas.height - 5);
    }
    
    // Horizontal grid lines every 1 meter
    for (let y = 0; y <= 5; y++) {
        ctx.beginPath();
        const gridPoint = worldToCanvas(0, y);
        ctx.moveTo(0, gridPoint.y);
        ctx.lineTo(canvas.width, gridPoint.y);
        ctx.stroke();
        
        // Add height label
        ctx.fillStyle = '#666';
        ctx.fillText(`${y}m`, 5, gridPoint.y - 5);
    }
    
    // Draw pitch point line
    ctx.setLineDash([]);
    ctx.beginPath();
    const pitchPoint = worldToCanvas(pitchDistance, 0);
    ctx.moveTo(pitchPoint.x, 0);
    ctx.lineTo(pitchPoint.x, canvas.height);
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#2e7d32';
    ctx.fillText('Pitch Point', pitchPoint.x - 30, 20);
    
    // Draw trajectory for ball 1 (red)
    ctx.beginPath();
    const start1 = worldToCanvas(trajectory1.points[0].x, trajectory1.points[0].y);
    ctx.moveTo(start1.x, start1.y);
    
    trajectory1.points.forEach(point => {
        const canvasPoint = worldToCanvas(point.x, point.y);
        ctx.lineTo(canvasPoint.x, canvasPoint.y);
    });
    
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw trajectory for ball 2 (blue)
    ctx.beginPath();
    const start2 = worldToCanvas(trajectory2.points[0].x, trajectory2.points[0].y);
    ctx.moveTo(start2.x, start2.y);
    
    trajectory2.points.forEach(point => {
        const canvasPoint = worldToCanvas(point.x, point.y);
        ctx.lineTo(canvasPoint.x, canvasPoint.y);
    });
    
    ctx.strokeStyle = '#1976d2';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw points for both balls
    function drawBallPoints(trajectory, color) {
        const points = trajectory.points;
        
        // Release point
        const releasePoint = worldToCanvas(points[0].x, points[0].y);
        ctx.beginPath();
        ctx.arc(releasePoint.x, releasePoint.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Draw pitch point
        const canvasPitchPoint = worldToCanvas(trajectory.pitchPoint.x, trajectory.pitchPoint.y);
        ctx.beginPath();
        ctx.arc(canvasPitchPoint.x, canvasPitchPoint.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Draw bounce point if it exists
        const bouncePoint = trajectory.bouncePoint;
        if (bouncePoint) {
            const canvasBouncePoint = worldToCanvas(bouncePoint.x, bouncePoint.y);
            ctx.beginPath();
            ctx.arc(canvasBouncePoint.x, canvasBouncePoint.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }

        // Draw point at stumps
        if (trajectory.heightAtStumps !== null) {
            const stumpsPoint = worldToCanvas(STUMPS_DISTANCE, trajectory.heightAtStumps);
            ctx.beginPath();
            ctx.arc(stumpsPoint.x, stumpsPoint.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            
            // Draw height line at stumps
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.moveTo(stumpsPoint.x, stumpsPoint.y);
            ctx.lineTo(stumpsPoint.x, worldToCanvas(STUMPS_DISTANCE, 0).y);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Add height label
            ctx.fillStyle = color;
            ctx.textAlign = 'left';
            ctx.fillText(`${trajectory.heightAtStumps.toFixed(2)}m`, stumpsPoint.x + 5, stumpsPoint.y);
        }
    }
    
    drawBallPoints(trajectory1, '#d32f2f');
    drawBallPoints(trajectory2, '#1976d2');

    // Draw stumps line
    ctx.beginPath();
    const stumpsLine = worldToCanvas(STUMPS_DISTANCE, 0);
    ctx.moveTo(stumpsLine.x, 0);
    ctx.lineTo(stumpsLine.x, canvas.height);
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#2e7d32';
    ctx.textAlign = 'center';
    ctx.fillText('Stumps', stumpsLine.x, 40);
}

// Update results
function updateResults(trajectory1, trajectory2) {
    const heightAtStumps1 = trajectory1.heightAtStumps;
    const heightAtStumps2 = trajectory2.heightAtStumps;
    const heightDifference = Math.abs(heightAtStumps2 - heightAtStumps1);

    resultsDiv.innerHTML = `
        <div class="col-md-6">
            <div class="card ball-1">
                <div class="card-body">
                    <h3 class="card-title">Ball 1 (Red)</h3>
                    <p class="mb-2">Release Height: ${trajectory1.points[0].y.toFixed(2)} m</p>
                    <p class="mb-0">Height at Stumps: ${heightAtStumps1.toFixed(2)} m</p>
                </div>
            </div>
        </div>
        <div class="col-md-6">
            <div class="card ball-2">
                <div class="card-body">
                    <h3 class="card-title">Ball 2 (Blue)</h3>
                    <p class="mb-2">Release Height: ${trajectory2.points[0].y.toFixed(2)} m</p>
                    <p class="mb-0">Height at Stumps: ${heightAtStumps2.toFixed(2)} m</p>
                </div>
            </div>
        </div>
       <div class="col-12">
            <div class="card">
                <div class="card-body difference text-center">
                    <p class="h5 mb-0">Difference in Height at Stumps: ${(heightDifference * 100).toFixed(1)} cm</p>
                </div>
            </div>
        </div>
    `;
}

// Handle calculation
function handleCalculate() {
    const releaseHeight1 = parseFloat(releaseHeight1Input.value);
    const releaseHeight2 = parseFloat(releaseHeight2Input.value);
    const ballSpeed = parseFloat(ballSpeedInput.value);
    const pitchDistance = parseFloat(pitchDistanceInput.value);
    
    const trajectory1 = calculateTrajectory(releaseHeight1, ballSpeed, pitchDistance);
    const trajectory2 = calculateTrajectory(releaseHeight2, ballSpeed, pitchDistance);
    
    drawTrajectories(trajectory1, trajectory2, pitchDistance);
    updateResults(trajectory1, trajectory2);
}

// Event listeners
calculateBtn.addEventListener('click', handleCalculate);
ballSpeedInput.addEventListener('input', handleCalculate);
releaseHeight1Input.addEventListener('input', handleCalculate);
releaseHeight2Input.addEventListener('input', handleCalculate);
pitchDistanceInput.addEventListener('input', handleCalculate);

// Initial calculation
handleCalculate();
