import type { GameInput } from './types.ts';

// ---------------------------------------------------------------------------
// 1. CYBER SNAKE RULES
// ---------------------------------------------------------------------------
export interface SnakeSegment {
  x: number;
  y: number;
}

export interface SnakeState {
  body: SnakeSegment[];
  direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  nextDirection: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  food: { x: number; y: number; type: 'normal' | 'super'; points: number };
  score: number;
  length: number;
  gridSize: number;
  cols: number;
  rows: number;
  moveTimer: number;
  moveInterval: number;
  isGameOver: boolean;
}

export function initSnakeState(cols = 48, rows = 27, gridSize = 40): SnakeState {
  const startX = Math.floor(cols / 4);
  const startY = Math.floor(rows / 2);
  return {
    body: [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
      { x: startX - 3, y: startY },
    ],
    direction: 'RIGHT',
    nextDirection: 'RIGHT',
    food: { x: Math.floor(cols / 2), y: startY, type: 'normal', points: 100 },
    score: 0,
    length: 4,
    gridSize,
    cols,
    rows,
    moveTimer: 0,
    moveInterval: 0.08,
    isGameOver: false,
  };
}

export function applySnakeInput(state: SnakeState, input: GameInput): void {
  let requested: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null = null;
  if (input.stickY < -0.4) requested = 'UP';
  else if (input.stickY > 0.4) requested = 'DOWN';
  else if (input.stickX < -0.4) requested = 'LEFT';
  else if (input.stickX > 0.4) requested = 'RIGHT';

  if (!requested) return;

  const current = state.direction;
  if (requested === 'UP' && current !== 'DOWN') state.nextDirection = 'UP';
  if (requested === 'DOWN' && current !== 'UP') state.nextDirection = 'DOWN';
  if (requested === 'LEFT' && current !== 'RIGHT') state.nextDirection = 'LEFT';
  if (requested === 'RIGHT' && current !== 'LEFT') state.nextDirection = 'RIGHT';
}

export function tickSnake(state: SnakeState): boolean {
  if (state.isGameOver) return false;

  state.direction = state.nextDirection;
  const head = state.body[0];
  let nextX = head.x;
  let nextY = head.y;

  if (state.direction === 'UP') nextY -= 1;
  else if (state.direction === 'DOWN') nextY += 1;
  else if (state.direction === 'LEFT') nextX -= 1;
  else if (state.direction === 'RIGHT') nextX += 1;

  // Wall collisions wrap around in cyber grid!
  if (nextX < 0) nextX = state.cols - 1;
  if (nextX >= state.cols) nextX = 0;
  if (nextY < 0) nextY = state.rows - 1;
  if (nextY >= state.rows) nextY = 0;

  // Self collision check
  for (let i = 1; i < state.body.length; i++) {
    if (state.body[i].x === nextX && state.body[i].y === nextY) {
      state.isGameOver = true;
      return false;
    }
  }

  // Insert new head
  state.body.unshift({ x: nextX, y: nextY });

  // Food check
  let ateFood = false;
  if (nextX === state.food.x && nextY === state.food.y) {
    state.score += state.food.points;
    state.length += 2;
    ateFood = true;

    // Spawn new food
    let valid = false;
    while (!valid) {
      const rx = Math.floor(Math.random() * (state.cols - 2)) + 1;
      const ry = Math.floor(Math.random() * (state.rows - 2)) + 1;
      const inBody = state.body.some(seg => seg.x === rx && seg.y === ry);
      if (!inBody) {
        state.food = {
          x: rx,
          y: ry,
          type: Math.random() > 0.8 ? 'super' : 'normal',
          points: Math.random() > 0.8 ? 250 : 100,
        };
        valid = true;
      }
    }
  }

  while (state.body.length > state.length) {
    state.body.pop();
  }

  return ateFood;
}

// ---------------------------------------------------------------------------
// 2. GALACTIC INVADERS RULES
// ---------------------------------------------------------------------------
export interface InvaderAlien {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  alive: boolean;
  type: 1 | 2 | 3; // Crab, Squid, Octopus
  points: number;
}

export interface BunkerShield {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export function initInvadersGrid(): { aliens: InvaderAlien[]; bunkers: BunkerShield[] } {
  const aliens: InvaderAlien[] = [];
  let id = 1;
  const startX = 360;
  const startY = 160;
  const spacingX = 100;
  const spacingY = 70;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 11; c++) {
      const type = (r === 0 ? 1 : r <= 2 ? 2 : 3) as 1 | 2 | 3;
      aliens.push({
        id: id++,
        row: r,
        col: c,
        x: startX + c * spacingX,
        y: startY + r * spacingY,
        alive: true,
        type,
        points: type === 1 ? 30 : type === 2 ? 20 : 10,
      });
    }
  }

  const bunkers: BunkerShield[] = [];
  const bunkerSpacing = 360;
  for (let b = 0; b < 4; b++) {
    bunkers.push({
      x: 420 + b * bunkerSpacing,
      y: 840,
      hp: 12,
      maxHp: 12,
    });
  }

  return { aliens, bunkers };
}

export function stepInvadersMarch(
  aliens: InvaderAlien[],
  direction: number,
  speed: number,
  arenaWidth = 1920
): { newDirection: number; dropDown: boolean } {
  const activeAliens = aliens.filter(a => a.alive);
  if (activeAliens.length === 0) return { newDirection: direction, dropDown: false };

  let hitWall = false;
  for (const a of activeAliens) {
    if ((direction > 0 && a.x > arenaWidth - 180) || (direction < 0 && a.x < 180)) {
      hitWall = true;
      break;
    }
  }

  if (hitWall) {
    return { newDirection: -direction, dropDown: true };
  }

  return { newDirection: direction, dropDown: false };
}

// ---------------------------------------------------------------------------
// 3. NEON PONG HYPER PADDLE RULES
// ---------------------------------------------------------------------------
export interface PongBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
}

export interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

export function checkPaddleBallBounce(
  ball: PongBall,
  paddle: Paddle,
  isLeftPaddle: boolean
): boolean {
  // Check bounding box
  const halfH = paddle.h / 2;
  const halfW = paddle.w / 2;

  if (
    ball.y + ball.radius >= paddle.y - halfH &&
    ball.y - ball.radius <= paddle.y + halfH
  ) {
    if (isLeftPaddle && ball.x - ball.radius <= paddle.x + halfW && ball.x + ball.radius >= paddle.x - halfW && ball.vx < 0) {
      // Calculate bounce angle based on where ball hits paddle (-1 top to +1 bottom)
      const offset = (ball.y - paddle.y) / halfH;
      const angle = offset * (Math.PI / 3); // Max 60 deg
      ball.speed = Math.min(1800, ball.speed * 1.05);
      ball.vx = Math.abs(Math.cos(angle) * ball.speed);
      ball.vy = Math.sin(angle) * ball.speed;
      return true;
    } else if (!isLeftPaddle && ball.x + ball.radius >= paddle.x - halfW && ball.x - ball.radius <= paddle.x + halfW && ball.vx > 0) {
      const offset = (ball.y - paddle.y) / halfH;
      const angle = offset * (Math.PI / 3);
      ball.speed = Math.min(1800, ball.speed * 1.05);
      ball.vx = -Math.abs(Math.cos(angle) * ball.speed);
      ball.vy = Math.sin(angle) * ball.speed;
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 4. TURBO HIGHWAY RACER RULES
// ---------------------------------------------------------------------------
export interface RacerCar {
  x: number; // 0 to 1 across road lanes
  y: number;
  speed: number;
  maxSpeed: number;
  boost: boolean;
  lane: number;
}

export function updateRacerPosition(
  car: RacerCar,
  steerInput: number,
  gasInput: boolean,
  brakeInput: boolean,
  boostInput: boolean,
  dt: number
): void {
  const topSpeed = boostInput ? 320 : 240;
  if (gasInput) {
    car.speed = Math.min(topSpeed, car.speed + (boostInput ? 300 : 160) * dt);
  } else if (brakeInput) {
    car.speed = Math.max(0, car.speed - 320 * dt);
  } else {
    car.speed = Math.max(0, car.speed - 80 * dt);
  }

  // Steering scales with speed
  const steerAmount = (car.speed / topSpeed) * steerInput * 0.9 * dt;
  car.x = Math.max(0.08, Math.min(0.92, car.x + steerAmount));
}

// ---------------------------------------------------------------------------
// 5. VECTOR ASTEROIDS RULES
// ---------------------------------------------------------------------------
export interface VectorShip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // radians
  radius: number;
  score: number;
  lives: number;
}

export function updateVectorShipPhysics(
  ship: VectorShip,
  rotateInput: number,
  thrustInput: boolean,
  dt: number,
  arenaW = 1920,
  arenaH = 1080
): void {
  // Rotate
  ship.angle += rotateInput * 4.5 * dt;

  // Thrust in direction of facing
  if (thrustInput) {
    const accel = 650 * dt;
    ship.vx += Math.cos(ship.angle) * accel;
    ship.vy += Math.sin(ship.angle) * accel;
  }

  // Inertial friction
  ship.vx *= Math.pow(0.985, dt * 60);
  ship.vy *= Math.pow(0.985, dt * 60);

  // Position
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;

  // Screen wrap-around (Classic Asteroids style!)
  if (ship.x < 0) ship.x += arenaW;
  if (ship.x > arenaW) ship.x -= arenaW;
  if (ship.y < 0) ship.y += arenaH;
  if (ship.y > arenaH) ship.y -= arenaH;
}

// ---------------------------------------------------------------------------
// 6. SUPER PLUMBER (MARIO STYLE PLATFORMER) RULES
// ---------------------------------------------------------------------------
export type PlumberForm = 'small' | 'super' | 'fire';

export interface PlumberPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  form: PlumberForm;
  facing: 1 | -1;
  onGround: boolean;
  coyoteTimer: number;
  isJumping: boolean;
  isStarman: boolean;
  starTimer: number;
  lives: number;
  coins: number;
  score: number;
  invincibleTimer: number;
  isDead: boolean;
}

export interface PlumberItem {
  id: number;
  type: 'mushroom' | 'fireflower' | 'star' | 'coin_popup';
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  collected: boolean;
  emergeY: number;
  targetY: number;
  emerging: boolean;
}

export interface BrickDebris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  color: string;
  life: number;
  maxLife: number;
}

export type PlumberStageId = '1-1' | '1-2' | '1-3' | '1-4';
export type PlumberTheme = 'overworld' | 'underground' | 'athletic' | 'castle';

export interface FireBar {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  length: number;
}

export interface PlatformBlock {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'ground' | 'brick' | 'question' | 'empty_question' | 'pipe' | 'lava' | 'bridge' | 'axe' | 'mushroom_platform';
  hasCoin?: boolean;
  itemType?: 'mushroom' | 'fireflower' | 'star';
  bounceTimer?: number;
}

export interface PlatformEnemy {
  id: number;
  type: 'goomba' | 'koopa' | 'piranha' | 'paratroopa' | 'bowser' | 'podoboo';
  x: number;
  y: number;
  vx: number;
  vy?: number;
  w: number;
  h: number;
  alive: boolean;
  isSquashed: boolean;
  squashTimer: number;
  isShell?: boolean;
  shellMoving?: boolean;
  pipeBaseY?: number;
  piranhaOffset?: number;
  piranhaTimer?: number;
  isWinged?: boolean;
  wingTimer?: number;
  hp?: number;
  bowserBreathTimer?: number;
  podobooTimer?: number;
  podobooBaseY?: number;
}

export function initPlumberStage(stageId: PlumberStageId = '1-1'): {
  stageId: PlumberStageId;
  theme: PlumberTheme;
  title: string;
  player: PlumberPlayer;
  blocks: PlatformBlock[];
  enemies: PlatformEnemy[];
  fireBars: FireBar[];
  flagpoleX: number;
  items: PlumberItem[];
} {
  const player: PlumberPlayer = {
    x: 120,
    y: 700,
    vx: 0,
    vy: 0,
    w: 40,
    h: 56,
    form: 'small',
    facing: 1,
    onGround: true,
    coyoteTimer: 0.1,
    isJumping: false,
    isStarman: false,
    starTimer: 0,
    lives: 3,
    coins: 0,
    score: 0,
    invincibleTimer: 0,
    isDead: false,
  };

  const blocks: PlatformBlock[] = [];
  const enemies: PlatformEnemy[] = [];
  const fireBars: FireBar[] = [];
  let blockId = 1;
  let enemyId = 1;

  // =========================================================================
  // STAGE 1: WORLD 1-1 (CLASSIC OVERWORLD)
  // =========================================================================
  if (stageId === '1-1') {
    // Ground platforms
    blocks.push({ id: blockId++, x: 0, y: 880, w: 2200, h: 200, type: 'ground' });
    blocks.push({ id: blockId++, x: 2360, y: 880, w: 1800, h: 200, type: 'ground' });
    blocks.push({ id: blockId++, x: 4300, y: 880, w: 2200, h: 200, type: 'ground' });

    // Pipes
    blocks.push({ id: blockId++, x: 650, y: 760, w: 90, h: 120, type: 'pipe' });
    blocks.push({ id: blockId++, x: 1200, y: 700, w: 90, h: 180, type: 'pipe' });
    blocks.push({ id: blockId++, x: 1850, y: 640, w: 90, h: 240, type: 'pipe' });
    blocks.push({ id: blockId++, x: 3100, y: 720, w: 90, h: 160, type: 'pipe' });
    blocks.push({ id: blockId++, x: 4700, y: 680, w: 90, h: 200, type: 'pipe' });

    // Row 1: ? (Mushroom) - Brick - ? (Coin) - Brick - ? (Fire Flower)
    const row1X = 400;
    const row1Y = 640;
    blocks.push({ id: blockId++, x: row1X, y: row1Y, w: 50, h: 50, type: 'question', itemType: 'mushroom' });
    blocks.push({ id: blockId++, x: row1X + 50, y: row1Y, w: 50, h: 50, type: 'brick' });
    blocks.push({ id: blockId++, x: row1X + 100, y: row1Y, w: 50, h: 50, type: 'question', hasCoin: true });
    blocks.push({ id: blockId++, x: row1X + 150, y: row1Y, w: 50, h: 50, type: 'brick' });
    blocks.push({ id: blockId++, x: row1X + 200, y: row1Y, w: 50, h: 50, type: 'question', itemType: 'fireflower' });

    // Elevated brick row with Starman
    const row2X = 1450;
    const row2Y = 560;
    for (let i = 0; i < 6; i++) {
      blocks.push({
        id: blockId++,
        x: row2X + i * 50,
        y: row2Y,
        w: 50,
        h: 50,
        type: i === 2 ? 'question' : 'brick',
        hasCoin: i === 2 ? false : undefined,
        itemType: i === 2 ? 'star' : undefined,
      });
    }

    // High bonus coins
    blocks.push({ id: blockId++, x: 2600, y: 520, w: 50, h: 50, type: 'question', hasCoin: true });
    blocks.push({ id: blockId++, x: 2650, y: 520, w: 50, h: 50, type: 'question', itemType: 'fireflower' });
    blocks.push({ id: blockId++, x: 2700, y: 520, w: 50, h: 50, type: 'question', hasCoin: true });

    // Staircase to flagpole
    const stairX = 5300;
    for (let s = 1; s <= 6; s++) {
      blocks.push({
        id: blockId++,
        x: stairX + (s - 1) * 60,
        y: 880 - s * 50,
        w: 60,
        h: s * 50,
        type: 'brick',
      });
    }

    // Enemies
    enemies.push(
      { id: enemyId++, type: 'goomba', x: 520, y: 835, vx: -90, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
      { id: enemyId++, type: 'goomba', x: 950, y: 835, vx: -90, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
      { id: enemyId++, type: 'goomba', x: 1050, y: 835, vx: -90, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
      { id: enemyId++, type: 'piranha', x: 1227, y: 652, vx: 0, w: 36, h: 48, alive: true, isSquashed: false, squashTimer: 0, pipeBaseY: 700, piranhaOffset: 0, piranhaTimer: 0 },
      { id: enemyId++, type: 'goomba', x: 1600, y: 835, vx: -90, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
      { id: enemyId++, type: 'koopa', x: 2750, y: 830, vx: -110, w: 44, h: 50, alive: true, isSquashed: false, squashTimer: 0, isShell: false, shellMoving: false },
      { id: enemyId++, type: 'goomba', x: 3400, y: 835, vx: -90, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
      { id: enemyId++, type: 'goomba', x: 3550, y: 835, vx: -90, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
      { id: enemyId++, type: 'piranha', x: 4727, y: 632, vx: 0, w: 36, h: 48, alive: true, isSquashed: false, squashTimer: 0, pipeBaseY: 680, piranhaOffset: 0, piranhaTimer: 1.5 },
      { id: enemyId++, type: 'goomba', x: 4950, y: 835, vx: -90, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 }
    );

    return { stageId, theme: 'overworld', title: 'WORLD 1-1', player, blocks, enemies, fireBars, flagpoleX: 5800, items: [] };
  }

  // =========================================================================
  // STAGE 2: WORLD 1-2 (UNDERGROUND CAVERN)
  // =========================================================================
  if (stageId === '1-2') {
    // Blue subterranean cavern ground & ceiling
    blocks.push({ id: blockId++, x: 0, y: 880, w: 1800, h: 200, type: 'ground' });
    blocks.push({ id: blockId++, x: 1950, y: 880, w: 1500, h: 200, type: 'ground' });
    blocks.push({ id: blockId++, x: 3600, y: 880, w: 2000, h: 200, type: 'ground' });

    // Cavern Ceiling Stone
    blocks.push({ id: blockId++, x: 0, y: 0, w: 5600, h: 100, type: 'brick' });

    // Floating underground brick bridges
    for (let i = 0; i < 8; i++) {
      blocks.push({
        id: blockId++,
        x: 600 + i * 50,
        y: 620,
        w: 50,
        h: 50,
        type: i === 3 ? 'question' : 'brick',
        itemType: i === 3 ? 'mushroom' : undefined,
        hasCoin: i === 1 || i === 5,
      });
    }

    // High ceiling coin cache
    for (let c = 0; c < 5; c++) {
      blocks.push({ id: blockId++, x: 1200 + c * 50, y: 460, w: 50, h: 50, type: 'question', hasCoin: true });
    }

    // Underground pipes
    blocks.push({ id: blockId++, x: 1000, y: 720, w: 90, h: 160, type: 'pipe' });
    blocks.push({ id: blockId++, x: 2300, y: 680, w: 90, h: 200, type: 'pipe' });
    blocks.push({ id: blockId++, x: 3300, y: 640, w: 90, h: 240, type: 'pipe' });
    blocks.push({ id: blockId++, x: 4400, y: 740, w: 90, h: 140, type: 'pipe' });

    // Stepping elevator blocks over pit
    blocks.push({ id: blockId++, x: 1820, y: 720, w: 110, h: 30, type: 'brick' });

    // Secret Starman brick
    blocks.push({ id: blockId++, x: 2600, y: 580, w: 50, h: 50, type: 'question', itemType: 'star' });
    blocks.push({ id: blockId++, x: 2650, y: 580, w: 50, h: 50, type: 'brick' });
    blocks.push({ id: blockId++, x: 2700, y: 580, w: 50, h: 50, type: 'question', itemType: 'fireflower' });

    // Exit staircase
    for (let s = 1; s <= 7; s++) {
      blocks.push({ id: blockId++, x: 4700 + (s - 1) * 60, y: 880 - s * 50, w: 60, h: s * 50, type: 'brick' });
    }

    // Enemies (Troop of Goombas, Koopas, jumping Paratroopas!)
    enemies.push(
      { id: enemyId++, type: 'goomba', x: 480, y: 835, vx: -95, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
      { id: enemyId++, type: 'goomba', x: 560, y: 835, vx: -95, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
      { id: enemyId++, type: 'piranha', x: 1027, y: 672, vx: 0, w: 36, h: 48, alive: true, isSquashed: false, squashTimer: 0, pipeBaseY: 720, piranhaOffset: 0, piranhaTimer: 0.5 },
      { id: enemyId++, type: 'koopa', x: 1500, y: 830, vx: -110, w: 44, h: 50, alive: true, isSquashed: false, squashTimer: 0, isShell: false, shellMoving: false },
      { id: enemyId++, type: 'paratroopa', x: 2150, y: 700, vx: -90, w: 44, h: 50, alive: true, isSquashed: false, squashTimer: 0, isWinged: true, wingTimer: 0 },
      { id: enemyId++, type: 'piranha', x: 2327, y: 632, vx: 0, w: 36, h: 48, alive: true, isSquashed: false, squashTimer: 0, pipeBaseY: 680, piranhaOffset: 0, piranhaTimer: 1.2 },
      { id: enemyId++, type: 'goomba', x: 2900, y: 835, vx: -95, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
      { id: enemyId++, type: 'paratroopa', x: 3800, y: 680, vx: -90, w: 44, h: 50, alive: true, isSquashed: false, squashTimer: 0, isWinged: true, wingTimer: 0 },
      { id: enemyId++, type: 'koopa', x: 4100, y: 830, vx: -110, w: 44, h: 50, alive: true, isSquashed: false, squashTimer: 0, isShell: false, shellMoving: false }
    );

    return { stageId, theme: 'underground', title: 'WORLD 1-2', player, blocks, enemies, fireBars, flagpoleX: 5350, items: [] };
  }

  // =========================================================================
  // STAGE 3: WORLD 1-3 (ATHLETIC MUSHROOM HEIGHTS)
  // =========================================================================
  if (stageId === '1-3') {
    // Starting island
    blocks.push({ id: blockId++, x: 0, y: 880, w: 800, h: 200, type: 'ground' });

    // Giant Bouncy Mushroom Platforms in the sky!
    const shrooms = [
      { x: 950, y: 700, w: 180, h: 50 },
      { x: 1300, y: 560, w: 220, h: 50 },
      { x: 1700, y: 680, w: 180, h: 50 },
      { x: 2050, y: 520, w: 200, h: 50 },
      { x: 2450, y: 640, w: 240, h: 50 },
      { x: 2900, y: 480, w: 220, h: 50 },
      { x: 3350, y: 620, w: 200, h: 50 },
      { x: 3800, y: 540, w: 260, h: 50 },
    ];

    for (const sh of shrooms) {
      blocks.push({ id: blockId++, x: sh.x, y: sh.y, w: sh.w, h: sh.h, type: 'mushroom_platform' });
    }

    // Sky mystery blocks between mushrooms
    blocks.push({ id: blockId++, x: 1400, y: 380, w: 50, h: 50, type: 'question', itemType: 'mushroom' });
    blocks.push({ id: blockId++, x: 2150, y: 340, w: 50, h: 50, type: 'question', itemType: 'star' });
    blocks.push({ id: blockId++, x: 2550, y: 440, w: 50, h: 50, type: 'question', itemType: 'fireflower' });

    // Floating wooden bridge spans
    blocks.push({ id: blockId++, x: 4200, y: 680, w: 320, h: 30, type: 'brick' });

    // Flagpole island
    blocks.push({ id: blockId++, x: 4700, y: 880, w: 1200, h: 200, type: 'ground' });

    // Flying Paratroopas leaping over chasms!
    enemies.push(
      { id: enemyId++, type: 'paratroopa', x: 1000, y: 640, vx: -80, w: 44, h: 50, alive: true, isSquashed: false, squashTimer: 0, isWinged: true, wingTimer: 0 },
      { id: enemyId++, type: 'paratroopa', x: 1450, y: 500, vx: -85, w: 44, h: 50, alive: true, isSquashed: false, squashTimer: 0, isWinged: true, wingTimer: 1.0 },
      { id: enemyId++, type: 'koopa', x: 1800, y: 630, vx: -100, w: 44, h: 50, alive: true, isSquashed: false, squashTimer: 0, isShell: false, shellMoving: false },
      { id: enemyId++, type: 'paratroopa', x: 2200, y: 460, vx: -85, w: 44, h: 50, alive: true, isSquashed: false, squashTimer: 0, isWinged: true, wingTimer: 0.5 },
      { id: enemyId++, type: 'paratroopa', x: 3000, y: 420, vx: -90, w: 44, h: 50, alive: true, isSquashed: false, squashTimer: 0, isWinged: true, wingTimer: 1.5 },
      { id: enemyId++, type: 'goomba', x: 4300, y: 635, vx: -90, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 }
    );

    return { stageId, theme: 'athletic', title: 'WORLD 1-3', player, blocks, enemies, fireBars, flagpoleX: 5200, items: [] };
  }

  // =========================================================================
  // STAGE 4: WORLD 1-4 (BOWSER'S CASTLE FORTRESS)
  // =========================================================================
  // Theme: 'castle'
  // Dark stone, lava pits, revolving Fire Bars, Podoboo fireballs, Bowser boss on lava bridge!
  blocks.push({ id: blockId++, x: 0, y: 880, w: 900, h: 200, type: 'ground' });
  // Lava River 1
  blocks.push({ id: blockId++, x: 900, y: 920, w: 400, h: 160, type: 'lava' });
  blocks.push({ id: blockId++, x: 1300, y: 880, w: 800, h: 200, type: 'ground' });
  // Lava River 2
  blocks.push({ id: blockId++, x: 2100, y: 920, w: 450, h: 160, type: 'lava' });
  blocks.push({ id: blockId++, x: 2550, y: 880, w: 600, h: 200, type: 'ground' });

  // Bowser's Lava Cavern & Bridge
  blocks.push({ id: blockId++, x: 3150, y: 920, w: 1200, h: 160, type: 'lava' });
  // Destructible Bridge where Bowser stands
  blocks.push({ id: blockId++, x: 3150, y: 820, w: 800, h: 30, type: 'bridge' });
  // Solid ledge holding the Golden Axe button
  blocks.push({ id: blockId++, x: 3950, y: 820, w: 200, h: 260, type: 'ground' });
  // The Golden Axe (cuts the bridge!)
  blocks.push({ id: blockId++, x: 4020, y: 760, w: 40, h: 60, type: 'axe' });
  // Final Princess / Toad Chamber
  blocks.push({ id: blockId++, x: 4150, y: 820, w: 600, h: 260, type: 'ground' });

  // Floating battlements and mystery powerups
  blocks.push({ id: blockId++, x: 500, y: 640, w: 50, h: 50, type: 'question', itemType: 'mushroom' });
  blocks.push({ id: blockId++, x: 1600, y: 620, w: 50, h: 50, type: 'question', itemType: 'fireflower' });
  blocks.push({ id: blockId++, x: 2750, y: 600, w: 50, h: 50, type: 'question', itemType: 'fireflower' });

  // Revolving Fire Bars (spinning chains of flame!)
  fireBars.push({ id: 1, x: 700, y: 740, angle: 0, speed: 2.2, length: 120 });
  fireBars.push({ id: 2, x: 1750, y: 720, angle: Math.PI / 2, speed: -2.5, length: 130 });
  fireBars.push({ id: 3, x: 2850, y: 680, angle: 0, speed: 2.8, length: 140 });

  // Leaping Podoboos (lava fireballs)
  enemies.push(
    { id: enemyId++, type: 'podoboo', x: 1100, y: 920, vx: 0, vy: -750, w: 28, h: 32, alive: true, isSquashed: false, squashTimer: 0, podobooBaseY: 920, podobooTimer: 0 },
    { id: enemyId++, type: 'podoboo', x: 2320, y: 920, vx: 0, vy: -750, w: 28, h: 32, alive: true, isSquashed: false, squashTimer: 0, podobooBaseY: 920, podobooTimer: 1.2 }
  );

  // Bowser (King Koopa!) guards the bridge
  enemies.push({
    id: enemyId++,
    type: 'bowser',
    x: 3600,
    y: 730,
    vx: -60,
    w: 72,
    h: 88,
    alive: true,
    isSquashed: false,
    squashTimer: 0,
    hp: 5,
    bowserBreathTimer: 0,
  });

  return { stageId, theme: 'castle', title: 'WORLD 1-4', player, blocks, enemies, fireBars, flagpoleX: 4020, items: [] };
}

export function updatePlumberMovement(
  player: PlumberPlayer,
  blocks: PlatformBlock[],
  enemies: PlatformEnemy[],
  input: GameInput,
  dt: number,
  callbacks: {
    onJump?: () => void;
    onCoin?: () => void;
    onStomp?: () => void;
    onHurt?: () => void;
    onPowerup?: (type: 'mushroom' | 'fireflower' | 'star') => void;
    onItemSprout?: (item: PlumberItem) => void;
    onBrickBreak?: (block: PlatformBlock) => void;
    onKick?: () => void;
    onBowserHurt?: () => void;
    onAxeCut?: () => void;
  } = {},
  fireBars: FireBar[] = []
): void {
  if (player.isDead) return;

  // Starman Invincibility Countdown
  if (player.isStarman) {
    player.starTimer -= dt;
    if (player.starTimer <= 0) {
      player.isStarman = false;
      player.starTimer = 0;
    }
  }

  const gravity = 2100;
  const walkSpeed = 340;
  const sprintSpeed = 530;
  const isSprinting = input.fire || input.boost;
  const maxSpeed = isSprinting ? sprintSpeed : walkSpeed;
  const accel = 1900;
  const friction = 0.84;

  // Horizontal input
  const moveX = input.stickX;
  if (Math.abs(moveX) > 0.15) {
    player.vx += Math.sign(moveX) * accel * dt;
    player.facing = moveX > 0 ? 1 : -1;
  } else {
    player.vx *= Math.pow(friction, dt * 60);
    if (Math.abs(player.vx) < 5) player.vx = 0;
  }
  player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));

  // Jump trigger: [A] or Jump button
  const wantsJump = input.boost || input.stickY < -0.4;
  if (player.onGround) {
    player.coyoteTimer = 0.12;
  } else {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  }

  if (wantsJump && !player.isJumping && player.coyoteTimer > 0) {
    player.vy = -920;
    player.onGround = false;
    player.isJumping = true;
    player.coyoteTimer = 0;
    callbacks.onJump?.();
  }

  // Variable jump cut
  if (!wantsJump && player.vy < -250) {
    player.vy *= 0.52;
  }

  if (!wantsJump && player.onGround) {
    player.isJumping = false;
  }

  // Apply gravity
  player.vy += gravity * dt;
  player.vy = Math.min(1250, player.vy);

  // Apply velocity to position
  player.x += player.vx * dt;
  player.x = Math.max(0, player.x);

  // Horizontal block collision & hazards
  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const block = blocks[bi];
    if (
      player.x + player.w > block.x &&
      player.x < block.x + block.w &&
      player.y + player.h > block.y + 6 &&
      player.y < block.y + block.h - 6
    ) {
      if (block.type === 'lava') {
        // Falling or touching molten lava is instant death!
        player.lives--;
        player.isDead = true;
        player.vy = -800;
        callbacks.onHurt?.();
        return;
      } else if (block.type === 'axe') {
        // Cutting the Golden Axe chain!
        callbacks.onAxeCut?.();
        // Remove bridge blocks so Bowser plunges into lava!
        for (let bIndex = blocks.length - 1; bIndex >= 0; bIndex--) {
          if (blocks[bIndex].type === 'bridge') {
            blocks.splice(bIndex, 1);
          }
        }
        continue;
      }

      if (player.vx > 0) {
        player.x = block.x - player.w;
        player.vx = 0;
      } else if (player.vx < 0) {
        player.x = block.x + block.w;
        player.vx = 0;
      }
    }
  }

  // Vertical position and collision
  player.y += player.vy * dt;
  player.onGround = false;

  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const block = blocks[bi];
    if (
      player.x + player.w > block.x + 4 &&
      player.x < block.x + block.w - 4
    ) {
      if (block.type === 'lava' && player.y + player.h >= block.y + 10) {
        player.lives--;
        player.isDead = true;
        player.vy = -800;
        callbacks.onHurt?.();
        return;
      }

      // Landing on block top
      if (
        player.vy >= 0 &&
        player.y + player.h >= block.y &&
        player.y + player.h <= block.y + 24
      ) {
        if (block.type === 'axe') {
          callbacks.onAxeCut?.();
          for (let bIndex = blocks.length - 1; bIndex >= 0; bIndex--) {
            if (blocks[bIndex].type === 'bridge') {
              blocks.splice(bIndex, 1);
            }
          }
        } else {
          player.y = block.y - player.h;
          player.vy = 0;
          player.onGround = true;
          player.isJumping = false;
        }
      }
      // Hitting block from below
      else if (
        player.vy < 0 &&
        player.y <= block.y + block.h &&
        player.y >= block.y + block.h - 24
      ) {
        player.y = block.y + block.h;
        player.vy = 40;
        block.bounceTimer = 0.15;

        // Brick handling: Super/Fire Mario shatters brick! Small Mario bumps it.
        if (block.type === 'brick') {
          if (player.form === 'super' || player.form === 'fire') {
            callbacks.onBrickBreak?.(block);
            blocks.splice(bi, 1);
            player.score += 50;
            continue;
          } else {
            player.score += 10;
            callbacks.onCoin?.();
          }
        }
        // Question block handling: pop out item or coin
        else if (block.type === 'question') {
          block.type = 'empty_question';

          if (block.itemType) {
            let spawnType = block.itemType;
            if (spawnType === 'mushroom' && (player.form === 'super' || player.form === 'fire')) {
              spawnType = 'fireflower';
            }

            callbacks.onItemSprout?.({
              id: Date.now() + Math.random(),
              type: spawnType,
              x: block.x + 5,
              y: block.y,
              emergeY: block.y,
              targetY: block.y - 48,
              vx: 120,
              vy: 0,
              w: 40,
              h: 40,
              collected: false,
              emerging: true,
            });
          } else if (block.hasCoin) {
            block.hasCoin = false;
            player.coins += 1;
            player.score += 200;
            callbacks.onCoin?.();
          }
        }
      }
    }
  }

  // Fall down pit
  if (player.y > 1150) {
    player.lives--;
    player.isDead = true;
    callbacks.onHurt?.();
    return;
  }

  // Fire Bar revolving hazard collisions
  for (const fb of fireBars) {
    fb.angle += fb.speed * dt;
    if (player.invincibleTimer <= 0 && !player.isStarman) {
      const segCount = 5;
      const segSpacing = fb.length / segCount;
      for (let s = 1; s <= segCount; s++) {
        const fx = fb.x + Math.cos(fb.angle) * (s * segSpacing);
        const fy = fb.y + Math.sin(fb.angle) * (s * segSpacing);
        if (
          fx > player.x &&
          fx < player.x + player.w &&
          fy > player.y &&
          fy < player.y + player.h
        ) {
          if (player.form === 'super' || player.form === 'fire') {
            player.form = 'small';
            player.h = 56;
            player.invincibleTimer = 2.0;
            callbacks.onHurt?.();
          } else {
            player.lives--;
            player.isDead = true;
            callbacks.onHurt?.();
          }
          break;
        }
      }
    }
  }

  // Enemy updates and stomp collisions
  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    // Podoboo (Lava Fireball leaping up and down)
    if (enemy.type === 'podoboo') {
      const baseY = enemy.podobooBaseY || 920;
      enemy.vy = (enemy.vy || -750) + 1400 * dt;
      enemy.y += (enemy.vy || 0) * dt;

      if (enemy.y > baseY + 40) {
        enemy.podobooTimer = (enemy.podobooTimer || 0) + dt;
        if (enemy.podobooTimer > 1.4) {
          enemy.podobooTimer = 0;
          enemy.vy = -780;
          enemy.y = baseY;
        }
      }

      // Check collision with player
      if (
        player.x + player.w > enemy.x + 2 &&
        player.x < enemy.x + enemy.w - 2 &&
        player.y + player.h > enemy.y &&
        player.y < enemy.y + enemy.h
      ) {
        if (!player.isStarman && player.invincibleTimer <= 0) {
          if (player.form === 'super' || player.form === 'fire') {
            player.form = 'small';
            player.h = 56;
            player.invincibleTimer = 2.0;
            callbacks.onHurt?.();
          } else {
            player.lives--;
            player.isDead = true;
            callbacks.onHurt?.();
          }
        }
      }
      continue;
    }

    // Winged Paratroopa flying wave
    if (enemy.type === 'paratroopa') {
      enemy.wingTimer = (enemy.wingTimer || 0) + dt;
      enemy.x += enemy.vx * dt;
      enemy.y += Math.sin(enemy.wingTimer * 3.5) * 110 * dt;
    }

    // Bowser King Koopa Boss
    if (enemy.type === 'bowser') {
      enemy.x += enemy.vx * dt;
      // Patrol bridge
      if (enemy.x < 3250) {
        enemy.x = 3250;
        enemy.vx = Math.abs(enemy.vx);
      } else if (enemy.x > 3750) {
        enemy.x = 3750;
        enemy.vx = -Math.abs(enemy.vx);
      }

      // Periodic hop
      enemy.vy = (enemy.vy || 0) + gravity * dt;
      enemy.y += enemy.vy * dt;
      if (enemy.y > 730) {
        enemy.y = 730;
        enemy.vy = 0;
        if (Math.random() < 0.02) {
          enemy.vy = -450;
        }
      }
    }

    // Piranha plant animation in pipe
    if (enemy.type === 'piranha') {
      enemy.piranhaTimer = (enemy.piranhaTimer || 0) + dt;
      const cycle = enemy.piranhaTimer % 5.5;
      const distToMario = Math.abs(player.x - enemy.x);

      if (distToMario < 90) {
        enemy.piranhaOffset = 0;
      } else if (cycle < 1.2) {
        enemy.piranhaOffset = (cycle / 1.2) * 48;
      } else if (cycle < 2.8) {
        enemy.piranhaOffset = 48;
      } else if (cycle < 4.0) {
        enemy.piranhaOffset = (1 - (cycle - 2.8) / 1.2) * 48;
      } else {
        enemy.piranhaOffset = 0;
      }

      enemy.y = (enemy.pipeBaseY || 700) - (enemy.piranhaOffset || 0);

      // Collide with Mario if visible
      if ((enemy.piranhaOffset || 0) > 10) {
        const pRight = player.x + player.w;
        const pBottom = player.y + player.h;
        const eRight = enemy.x + enemy.w;
        const eBottom = enemy.y + enemy.h;
        if (pRight > enemy.x + 4 && player.x < eRight - 4 && pBottom > enemy.y && player.y < eBottom) {
          if (player.isStarman) {
            enemy.alive = false;
            player.score += 1000;
          } else if (player.invincibleTimer <= 0) {
            if (player.form === 'super' || player.form === 'fire') {
              player.form = 'small';
              player.h = 56;
              player.invincibleTimer = 2.0;
              callbacks.onHurt?.();
            } else {
              player.lives--;
              player.isDead = true;
              callbacks.onHurt?.();
            }
          }
        }
      }
      continue;
    }

    if (enemy.isSquashed) {
      enemy.squashTimer -= dt;
      if (enemy.squashTimer <= 0) enemy.alive = false;
      continue;
    }

    // Move enemy (Goomba or walking Koopa or sliding Shell)
    if (enemy.type === 'koopa' && enemy.isShell) {
      if (enemy.shellMoving) {
        enemy.x += enemy.vx * dt;

        for (const block of blocks) {
          if (block.type === 'pipe' || block.type === 'brick' || block.type === 'ground') {
            if (
              enemy.x + enemy.w > block.x &&
              enemy.x < block.x + block.w &&
              enemy.y + enemy.h > block.y + 6 &&
              enemy.y < block.y + block.h
            ) {
              enemy.vx = -enemy.vx;
              callbacks.onKick?.();
              break;
            }
          }
        }

        for (const other of enemies) {
          if (other.id !== enemy.id && other.alive && !other.isSquashed) {
            if (
              enemy.x + enemy.w > other.x &&
              enemy.x < other.x + other.w &&
              enemy.y + enemy.h > other.y &&
              enemy.y < other.y + other.h
            ) {
              other.alive = false;
              player.score += 400;
              callbacks.onStomp?.();
            }
          }
        }
      }
    } else if (enemy.type !== 'paratroopa' && enemy.type !== 'bowser') {
      enemy.x += enemy.vx * dt;
    }

    // Check enemy-player overlap
    const pRight = player.x + player.w;
    const pBottom = player.y + player.h;
    const eRight = enemy.x + enemy.w;
    const eBottom = enemy.y + enemy.h;

    const overlapX = pRight > enemy.x + 4 && player.x < eRight - 4;
    const overlapY = pBottom > enemy.y && player.y < eBottom;

    if (overlapX && overlapY) {
      // 1. Starman: running into any enemy instantly vaporizes them!
      if (player.isStarman) {
        enemy.alive = false;
        player.score += 1000;
        callbacks.onStomp?.();
        continue;
      }

      // 2. Koopa shell interaction
      if (enemy.type === 'koopa' && enemy.isShell) {
        if (!enemy.shellMoving) {
          enemy.shellMoving = true;
          enemy.vx = (player.facing || 1) * 720;
          callbacks.onKick?.();
          player.score += 400;
        } else if (player.vy > 0 && pBottom <= enemy.y + 24) {
          enemy.shellMoving = false;
          enemy.vx = 0;
          player.vy = -620;
          callbacks.onStomp?.();
        } else if (player.invincibleTimer <= 0) {
          if (player.form === 'super' || player.form === 'fire') {
            player.form = 'small';
            player.h = 56;
            player.invincibleTimer = 2.0;
            callbacks.onHurt?.();
          } else {
            player.lives--;
            player.isDead = true;
            callbacks.onHurt?.();
          }
        }
        continue;
      }

      // 3. Stomp Paratroopa -> loses wings!
      if (enemy.type === 'paratroopa' && player.vy > 0 && pBottom <= enemy.y + 32) {
        enemy.type = 'koopa';
        enemy.isWinged = false;
        player.vy = -620;
        player.score += 400;
        callbacks.onStomp?.();
        continue;
      }

      // 4. Stomp Bowser (cannot be squashed, damages player unless axe or fireballs)
      if (enemy.type === 'bowser') {
        if (player.invincibleTimer <= 0) {
          if (player.form === 'super' || player.form === 'fire') {
            player.form = 'small';
            player.h = 56;
            player.invincibleTimer = 2.0;
            callbacks.onHurt?.();
          } else {
            player.lives--;
            player.isDead = true;
            callbacks.onHurt?.();
          }
        }
        continue;
      }

      // 5. Stomp Goomba or Koopa from above!
      if (player.vy > 0 && (pBottom - player.vy * dt <= enemy.y + 28 || pBottom <= enemy.y + enemy.h * 0.75)) {
        if (enemy.type === 'koopa') {
          enemy.isShell = true;
          enemy.shellMoving = false;
          enemy.vx = 0;
          enemy.h = 36;
          enemy.y += 14;
          player.vy = -620;
          player.score += 200;
          callbacks.onStomp?.();
        } else {
          enemy.isSquashed = true;
          enemy.squashTimer = 0.35;
          player.vy = -620;
          player.score += 200;
          callbacks.onStomp?.();
        }
      }
      // 6. Hurt from side
      else if (player.invincibleTimer <= 0) {
        if (player.form === 'super' || player.form === 'fire') {
          player.form = 'small';
          player.h = 56;
          player.invincibleTimer = 2.0;
          callbacks.onHurt?.();
        } else {
          player.lives--;
          player.invincibleTimer = 1.5;
          callbacks.onHurt?.();
          if (player.lives <= 0) {
            player.isDead = true;
          }
        }
      }
    }
  }

  if (player.invincibleTimer > 0) {
    player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);
  }
}

