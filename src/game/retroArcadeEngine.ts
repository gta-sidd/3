import { GameEngine } from './engine.ts';
import {
  initSnakeState,
  applySnakeInput,
  tickSnake,
  SnakeState,
  initInvadersGrid,
  stepInvadersMarch,
  InvaderAlien,
  BunkerShield,
  PongBall,
  Paddle,
  checkPaddleBallBounce,
  RacerCar,
  updateRacerPosition,
  VectorShip,
  updateVectorShipPhysics,
  initPlumberStage,
  updatePlumberMovement,
  PlumberPlayer,
  PlatformBlock,
  PlatformEnemy,
  PlumberItem,
  BrickDebris,
  PlumberForm,
  PlumberStageId,
  PlumberTheme,
  FireBar,
} from './retroRules.ts';
import type { GameInput, GameStatus } from './types.ts';
import type { RetroGameId } from './retroGames.ts';
import { sound } from './audio.ts';

export const ARENA_WIDTH = 1920;
export const ARENA_HEIGHT = 1080;

export class RetroArcadeEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public activeGame: RetroGameId = 'super_plumber';
  public status: GameStatus = 'title';

  // Sub-engines
  public voidEngine: GameEngine;

  // Snake State
  public snakeState: SnakeState;
  private snakeTimer: number = 0;

  // Invaders State
  public invaderAliens: InvaderAlien[] = [];
  public invaderBunkers: BunkerShield[] = [];
  public invaderPlayerX: number = ARENA_WIDTH / 2;
  public invaderDirection: number = 1;
  public invaderSpeed: number = 80;
  public invaderMarchTimer: number = 0;
  public invaderBullets: Array<{ x: number; y: number; vy: number; isPlayer: boolean }> = [];
  public invaderUfo: { x: number; y: number; active: boolean; score: number } = { x: -100, y: 100, active: false, score: 300 };
  public invaderPlayerHp: number = 3;
  public invaderScore: number = 0;

  // Pong State
  public pongBall: PongBall = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, vx: 550, vy: 250, radius: 14, speed: 600 };
  public playerPaddle: Paddle = { x: 90, y: ARENA_HEIGHT / 2, w: 24, h: 180, score: 0 };
  public aiPaddle: Paddle = { x: ARENA_WIDTH - 90, y: ARENA_HEIGHT / 2, w: 24, h: 180, score: 0 };
  public pongRally: number = 0;

  // Turbo Racer State
  public racerPlayer: RacerCar = { x: 0.5, y: 840, speed: 120, maxSpeed: 280, boost: false, lane: 2 };
  public racerTraffic: Array<{ x: number; y: number; speed: number; color: string }> = [];
  public racerRoadOffset: number = 0;
  public racerScore: number = 0;
  public racerLapTime: number = 0;

  // Vector Asteroids State
  public vectorShip: VectorShip = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, vx: 0, vy: 0, angle: -Math.PI / 2, radius: 18, score: 0, lives: 3 };
  public vectorRocks: Array<{ x: number; y: number; vx: number; vy: number; radius: number; points: number }> = [];
  public vectorShots: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
  public vectorUfo: { x: number; y: number; vx: number; active: boolean } = { x: -80, y: 200, vx: 180, active: false };

  // Super Plumber (Mario 1985) State
  public currentPlumberStageId: PlumberStageId = '1-1';
  public plumberStage!: {
    stageId: PlumberStageId;
    theme: PlumberTheme;
    title: string;
    player: PlumberPlayer;
    blocks: PlatformBlock[];
    enemies: PlatformEnemy[];
    fireBars: FireBar[];
    flagpoleX: number;
    items: PlumberItem[];
  };
  public plumberCameraX: number = 0;
  public plumberTime: number = 400;
  public plumberFireballs: Array<{ x: number; y: number; vx: number; vy: number; bounces: number }> = [];
  public bowserFireballs: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
  public plumberParticles: Array<{ x: number; y: number; vx: number; vy: number; color: string; life: number; maxLife: number; size: number; text?: string }> = [];
  public plumberBrickDebris: BrickDebris[] = [];
  public plumberFireworks: Array<{ x: number; y: number; vx: number; vy: number; color: string; life: number; maxLife: number; size: number }> = [];
  public plumberSkidPuffs: Array<{ x: number; y: number; radius: number; life: number; maxLife: number }> = [];
  public plumberStageClear: boolean = false;
  public plumberFlagY: number = 320;
  public plumberClearTimer: number = 0;
  public bowserDefeated: boolean = false;
  public axeActivated: boolean = false;
  public grandFinale: boolean = false;
  private prevFireInput: boolean = false;

  // Inputs
  public currentInput: GameInput = {
    stickX: 0,
    stickY: 0,
    fire: false,
    boost: false,
    shield: false,
    bomb: false,
  };

  private lastTime: number = 0;
  private animId: number = 0;

  public onStatsChange?: (stats: {
    score: number;
    health: number;
    shield: number;
    energy: number;
    bombCharge: number;
    wave: number;
    status: GameStatus;
    combo: number;
  }) => void;

  public onHapticTrigger?: (playerId: number, pattern: number[], health: number, shield: number, score: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.voidEngine = new GameEngine(canvas);
    this.snakeState = initSnakeState();
    this.initInvaders();
    this.initRacer();
    this.initVectorAsteroids();
    this.initPlumber();

    this.voidEngine.onStatsChange = (s) => {
      if (this.activeGame === 'void_horizon' && this.onStatsChange) {
        this.onStatsChange(s);
        this.status = s.status;
      }
    };
    this.voidEngine.onHapticTrigger = (id, pat, hp, sh, sc) => {
      if (this.activeGame === 'void_horizon' && this.onHapticTrigger) {
        this.onHapticTrigger(id, pat, hp, sh, sc);
      }
    };
  }

  public setGame(gameId: RetroGameId) {
    this.activeGame = gameId;
    this.status = 'title';
    document.body.dataset.state = 'title';
    if (gameId === 'void_horizon') {
      this.voidEngine.status = 'title';
    } else if (gameId === 'cyber_snake') {
      this.snakeState = initSnakeState();
    } else if (gameId === 'galactic_invaders') {
      this.initInvaders();
    } else if (gameId === 'neon_pong') {
      this.resetPongBall();
      this.playerPaddle.score = 0;
      this.aiPaddle.score = 0;
    } else if (gameId === 'turbo_racer') {
      this.initRacer();
    } else if (gameId === 'vector_asteroids') {
      this.initVectorAsteroids();
    } else if (gameId === 'super_plumber') {
      this.initPlumber();
    }
    this.render();
  }

  public setInput(input: GameInput) {
    this.currentInput = { ...input };
    if (this.activeGame === 'void_horizon') {
      this.voidEngine.setInput(1, input);
    } else if (this.activeGame === 'cyber_snake') {
      applySnakeInput(this.snakeState, input);
    } else if (this.activeGame === 'super_plumber') {
      if (input.fire && !this.prevFireInput && !this.plumberStage.player.isDead && !this.plumberStageClear) {
        this.spawnPlumberFireball();
      }
      this.prevFireInput = !!input.fire;
    }
  }

  public startGame() {
    this.status = 'playing';
    document.body.dataset.state = 'playing';

    if (this.activeGame === 'void_horizon') {
      this.voidEngine.startGame();
    } else if (this.activeGame === 'cyber_snake') {
      this.snakeState = initSnakeState();
    } else if (this.activeGame === 'galactic_invaders') {
      this.initInvaders();
    } else if (this.activeGame === 'neon_pong') {
      this.resetPongBall();
      this.playerPaddle.score = 0;
      this.aiPaddle.score = 0;
    } else if (this.activeGame === 'turbo_racer') {
      this.initRacer();
    } else if (this.activeGame === 'vector_asteroids') {
      this.initVectorAsteroids();
    } else if (this.activeGame === 'super_plumber') {
      this.initPlumber();
    }

    this.lastTime = performance.now();
    this.runLoop();
  }

  public pauseGame() {
    if (this.status === 'playing') {
      this.status = 'paused';
      document.body.dataset.state = 'paused';
      if (this.activeGame === 'void_horizon') this.voidEngine.pauseGame();
    } else if (this.status === 'paused') {
      this.status = 'playing';
      document.body.dataset.state = 'playing';
      if (this.activeGame === 'void_horizon') this.voidEngine.pauseGame();
      this.lastTime = performance.now();
      this.runLoop();
    }
  }

  public restartGame() {
    this.startGame();
  }

  public stop() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.voidEngine.stop();
  }

  public runLoop = () => {
    if (this.status !== 'playing') return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.activeGame === 'void_horizon') {
      // Handled by voidEngine
    } else if (this.activeGame === 'cyber_snake') {
      this.updateSnake(dt);
      this.renderSnake();
    } else if (this.activeGame === 'galactic_invaders') {
      this.updateInvaders(dt);
      this.renderInvaders();
    } else if (this.activeGame === 'neon_pong') {
      this.updatePong(dt);
      this.renderPong();
    } else if (this.activeGame === 'turbo_racer') {
      this.updateRacer(dt);
      this.renderRacer();
    } else if (this.activeGame === 'vector_asteroids') {
      this.updateVectorAsteroids(dt);
      this.renderVectorAsteroids();
    } else if (this.activeGame === 'super_plumber') {
      this.updatePlumber(dt);
      this.renderPlumber();
    }

    this.animId = requestAnimationFrame(this.runLoop);
  };

  // -------------------------------------------------------------------------
  // 1. CYBER SNAKE
  // -------------------------------------------------------------------------
  private updateSnake(dt: number) {
    if (this.snakeState.isGameOver) {
      this.status = 'gameover';
      document.body.dataset.state = 'gameover';
      return;
    }

    this.snakeTimer += dt;
    const interval = this.currentInput.boost ? 0.04 : 0.08;
    if (this.snakeTimer >= interval) {
      this.snakeTimer = 0;
      const ateFood = tickSnake(this.snakeState);
      if (ateFood) {
        sound.playBlip(720, 0.1);
        if (this.onHapticTrigger) this.onHapticTrigger(1, [60], 5, 100, this.snakeState.score);
      }
    }

    if (this.onStatsChange) {
      this.onStatsChange({
        score: this.snakeState.score,
        health: this.snakeState.isGameOver ? 0 : 5,
        shield: 100,
        energy: this.currentInput.boost ? 40 : 100,
        bombCharge: 100,
        wave: Math.floor(this.snakeState.score / 500) + 1,
        status: this.status,
        combo: Math.min(8, Math.floor(this.snakeState.length / 5)),
      });
    }
  }

  private renderSnake() {
    const ctx = this.ctx;
    ctx.fillStyle = '#050914';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Neon Grid
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)';
    ctx.lineWidth = 1;
    const sz = this.snakeState.gridSize;
    for (let x = 0; x < ARENA_WIDTH; x += sz) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < ARENA_HEIGHT; y += sz) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA_WIDTH, y);
      ctx.stroke();
    }

    // Food Core
    const fx = this.snakeState.food.x * sz + sz / 2;
    const fy = this.snakeState.food.y * sz + sz / 2;
    ctx.fillStyle = this.snakeState.food.type === 'super' ? '#f59e0b' : '#38bdf8';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(fx, fy, sz * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Snake Body
    for (let i = 0; i < this.snakeState.body.length; i++) {
      const seg = this.snakeState.body[i];
      const isHead = i === 0;
      ctx.fillStyle = isHead ? '#ffffff' : '#10b981';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = isHead ? 20 : 10;
      ctx.fillRect(seg.x * sz + 2, seg.y * sz + 2, sz - 4, sz - 4);
    }
    ctx.shadowBlur = 0;
  }

  // -------------------------------------------------------------------------
  // 2. GALACTIC INVADERS
  // -------------------------------------------------------------------------
  private initInvaders() {
    const data = initInvadersGrid();
    this.invaderAliens = data.aliens;
    this.invaderBunkers = data.bunkers;
    this.invaderPlayerX = ARENA_WIDTH / 2;
    this.invaderDirection = 1;
    this.invaderSpeed = 80;
    this.invaderBullets = [];
    this.invaderPlayerHp = 3;
    this.invaderScore = 0;
  }

  private updateInvaders(dt: number) {
    if (this.invaderPlayerHp <= 0) {
      this.status = 'gameover';
      document.body.dataset.state = 'gameover';
      return;
    }

    // Player Steer
    const steer = this.currentInput.stickX;
    this.invaderPlayerX += steer * 600 * dt;
    this.invaderPlayerX = Math.max(120, Math.min(ARENA_WIDTH - 120, this.invaderPlayerX));

    // Player Fire
    if (this.currentInput.fire && this.invaderBullets.filter(b => b.isPlayer).length < 2) {
      sound.playLaser(200);
      this.invaderBullets.push({
        x: this.invaderPlayerX,
        y: 920,
        vy: -900,
        isPlayer: true,
      });
    }

    // March Swarm
    this.invaderMarchTimer += dt;
    if (this.invaderMarchTimer >= 0.04) {
      this.invaderMarchTimer = 0;
      const step = stepInvadersMarch(this.invaderAliens, this.invaderDirection, this.invaderSpeed, ARENA_WIDTH);
      if (step.dropDown) {
        this.invaderDirection = step.newDirection;
        for (const a of this.invaderAliens) {
          if (a.alive) a.y += 35;
        }
        sound.playRetroMarch();
      } else {
        for (const a of this.invaderAliens) {
          if (a.alive) a.x += this.invaderDirection * this.invaderSpeed * 0.04;
        }
      }
    }

    // Alien fire random bombs
    if (Math.random() < 0.03 && this.invaderBullets.filter(b => !b.isPlayer).length < 4) {
      const liveAliens = this.invaderAliens.filter(a => a.alive);
      if (liveAliens.length > 0) {
        const shooter = liveAliens[Math.floor(Math.random() * liveAliens.length)];
        this.invaderBullets.push({
          x: shooter.x,
          y: shooter.y + 20,
          vy: 360,
          isPlayer: false,
        });
      }
    }

    // Bullets update
    for (let i = this.invaderBullets.length - 1; i >= 0; i--) {
      const b = this.invaderBullets[i];
      b.y += b.vy * dt;

      if (b.y < 0 || b.y > ARENA_HEIGHT) {
        this.invaderBullets.splice(i, 1);
        continue;
      }

      // Check hit alien
      if (b.isPlayer) {
        for (const a of this.invaderAliens) {
          if (a.alive && Math.hypot(b.x - a.x, b.y - a.y) < 30) {
            a.alive = false;
            this.invaderBullets.splice(i, 1);
            this.invaderScore += a.points;
            this.invaderSpeed += 2.5; // Swarm speeds up!
            sound.playExplosion(false);
            if (this.onHapticTrigger) this.onHapticTrigger(1, [40], 5, 100, this.invaderScore);
            break;
          }
        }
      } else {
        // Alien bomb hit player
        if (Math.hypot(b.x - this.invaderPlayerX, b.y - 960) < 36) {
          this.invaderBullets.splice(i, 1);
          this.invaderPlayerHp--;
          sound.playExplosion(true);
          if (this.onHapticTrigger) this.onHapticTrigger(1, [120, 50, 120], this.invaderPlayerHp, 0, this.invaderScore);
        }
      }
    }

    if (this.onStatsChange) {
      this.onStatsChange({
        score: this.invaderScore,
        health: this.invaderPlayerHp,
        shield: 100,
        energy: 100,
        bombCharge: 100,
        wave: 1,
        status: this.status,
        combo: 1,
      });
    }
  }

  private renderInvaders() {
    const ctx = this.ctx;
    ctx.fillStyle = '#06060c';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Render aliens
    for (const a of this.invaderAliens) {
      if (!a.alive) continue;
      ctx.fillStyle = a.type === 1 ? '#f43f5e' : a.type === 2 ? '#38bdf8' : '#eab308';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.fillRect(a.x - 22, a.y - 18, 44, 36);
    }
    ctx.shadowBlur = 0;

    // Render bunkers
    for (const b of this.invaderBunkers) {
      ctx.fillStyle = '#10b981';
      ctx.fillRect(b.x - 45, b.y, 90, 50);
    }

    // Render Player Cannon
    ctx.fillStyle = '#22c55e';
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 15;
    ctx.fillRect(this.invaderPlayerX - 30, 950, 60, 24);
    ctx.fillRect(this.invaderPlayerX - 8, 930, 16, 20);
    ctx.shadowBlur = 0;

    // Render Bullets
    for (const b of this.invaderBullets) {
      ctx.fillStyle = b.isPlayer ? '#38bdf8' : '#ef4444';
      ctx.fillRect(b.x - 3, b.y - 10, 6, 20);
    }
  }

  // -------------------------------------------------------------------------
  // 3. NEON PONG
  // -------------------------------------------------------------------------
  private resetPongBall() {
    this.pongBall.x = ARENA_WIDTH / 2;
    this.pongBall.y = ARENA_HEIGHT / 2;
    this.pongBall.speed = 650;
    const dir = Math.random() > 0.5 ? 1 : -1;
    this.pongBall.vx = dir * this.pongBall.speed;
    this.pongBall.vy = (Math.random() - 0.5) * 400;
  }

  private updatePong(dt: number) {
    // Player Paddle moved by stickY or Gyro
    let py = this.currentInput.stickY;
    if (this.currentInput.tiltY) py += this.currentInput.tiltY;
    this.playerPaddle.y += py * 850 * dt;
    this.playerPaddle.y = Math.max(100, Math.min(ARENA_HEIGHT - 100, this.playerPaddle.y));

    // AI Paddle tracking ball
    const diff = this.pongBall.y - this.aiPaddle.y;
    this.aiPaddle.y += Math.sign(diff) * Math.min(Math.abs(diff), 600 * dt);
    this.aiPaddle.y = Math.max(100, Math.min(ARENA_HEIGHT - 100, this.aiPaddle.y));

    // Ball movement
    this.pongBall.x += this.pongBall.vx * dt;
    this.pongBall.y += this.pongBall.vy * dt;

    // Top / bottom bounce
    if (this.pongBall.y - this.pongBall.radius <= 0 && this.pongBall.vy < 0) {
      this.pongBall.vy *= -1;
      sound.playBounce(320);
    }
    if (this.pongBall.y + this.pongBall.radius >= ARENA_HEIGHT && this.pongBall.vy > 0) {
      this.pongBall.vy *= -1;
      sound.playBounce(320);
    }

    // Paddle bounces
    if (checkPaddleBallBounce(this.pongBall, this.playerPaddle, true)) {
      this.pongRally++;
      sound.playBounce(480);
      if (this.onHapticTrigger) this.onHapticTrigger(1, [50], 5, 100, this.playerPaddle.score);
    }
    if (checkPaddleBallBounce(this.pongBall, this.aiPaddle, false)) {
      this.pongRally++;
      sound.playBounce(440);
    }

    // Goal scored
    if (this.pongBall.x < 0) {
      this.aiPaddle.score++;
      sound.playExplosion(false);
      this.resetPongBall();
    } else if (this.pongBall.x > ARENA_WIDTH) {
      this.playerPaddle.score++;
      sound.playBlip(880, 0.2);
      this.resetPongBall();
    }

    if (this.onStatsChange) {
      this.onStatsChange({
        score: this.playerPaddle.score * 1000 + this.pongRally * 50,
        health: 5,
        shield: 100,
        energy: 100,
        bombCharge: 100,
        wave: this.pongRally,
        status: this.status,
        combo: this.pongRally,
      });
    }
  }

  private renderPong() {
    const ctx = this.ctx;
    ctx.fillStyle = '#080812';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Center dotted line
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)';
    ctx.setLineDash([16, 16]);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ARENA_WIDTH / 2, 0);
    ctx.lineTo(ARENA_WIDTH / 2, ARENA_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Player Paddle (Left - Cyan)
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;
    ctx.fillRect(this.playerPaddle.x - this.playerPaddle.w / 2, this.playerPaddle.y - this.playerPaddle.h / 2, this.playerPaddle.w, this.playerPaddle.h);

    // AI Paddle (Right - Rose)
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 18;
    ctx.fillRect(this.aiPaddle.x - this.aiPaddle.w / 2, this.aiPaddle.y - this.aiPaddle.h / 2, this.aiPaddle.w, this.aiPaddle.h);

    // Ball (Yellow Pulse)
    ctx.fillStyle = '#eab308';
    ctx.shadowColor = '#eab308';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(this.pongBall.x, this.pongBall.y, this.pongBall.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Scores in massive numerals
    ctx.font = 'black 120px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.fillText(`${this.playerPaddle.score}`, ARENA_WIDTH / 4, 180);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.4)';
    ctx.fillText(`${this.aiPaddle.score}`, (ARENA_WIDTH * 3) / 4, 180);
  }

  // -------------------------------------------------------------------------
  // 4. TURBO HIGHWAY RACER
  // -------------------------------------------------------------------------
  private initRacer() {
    this.racerPlayer = { x: 0.5, y: 840, speed: 120, maxSpeed: 280, boost: false, lane: 2 };
    this.racerTraffic = [];
    for (let i = 0; i < 6; i++) {
      this.racerTraffic.push({
        x: 0.2 + Math.random() * 0.6,
        y: -100 - i * 280,
        speed: 80 + Math.random() * 60,
        color: i % 2 === 0 ? '#f43f5e' : '#eab308',
      });
    }
    this.racerScore = 0;
  }

  private updateRacer(dt: number) {
    const steer = this.currentInput.stickX;
    const gas = this.currentInput.fire || this.currentInput.boost || true;
    const brake = this.currentInput.shield;
    const boost = this.currentInput.boost;

    updateRacerPosition(this.racerPlayer, steer, gas, brake, boost, dt);

    this.racerRoadOffset = (this.racerRoadOffset + this.racerPlayer.speed * 4 * dt) % 120;
    this.racerScore += Math.round(this.racerPlayer.speed * dt * 2);

    // Move traffic
    for (const car of this.racerTraffic) {
      car.y += (this.racerPlayer.speed - car.speed) * 3 * dt;
      if (car.y > ARENA_HEIGHT + 100) {
        car.y = -150;
        car.x = 0.2 + Math.random() * 0.6;
      }

      // Collision check
      const playerPxX = ARENA_WIDTH * this.racerPlayer.x;
      const trafficPxX = ARENA_WIDTH * car.x;
      if (Math.hypot(playerPxX - trafficPxX, this.racerPlayer.y - car.y) < 65) {
        this.racerPlayer.speed = Math.max(30, this.racerPlayer.speed - 140);
        sound.playExplosion(false);
        if (this.onHapticTrigger) this.onHapticTrigger(1, [150], 3, 100, this.racerScore);
      }
    }

    if (this.onStatsChange) {
      this.onStatsChange({
        score: this.racerScore,
        health: 5,
        shield: 100,
        energy: boost ? 50 : 100,
        bombCharge: 100,
        wave: Math.floor(this.racerScore / 5000) + 1,
        status: this.status,
        combo: Math.floor(this.racerPlayer.speed / 40),
      });
    }
  }

  private renderRacer() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Roadway asphalt
    const roadLeft = ARENA_WIDTH * 0.15;
    const roadWidth = ARENA_WIDTH * 0.7;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(roadLeft, 0, roadWidth, ARENA_HEIGHT);

    // Road stripes
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 6;
    ctx.setLineDash([40, 40]);
    ctx.lineDashOffset = -this.racerRoadOffset;

    ctx.beginPath();
    ctx.moveTo(roadLeft + roadWidth * 0.33, 0);
    ctx.lineTo(roadLeft + roadWidth * 0.33, ARENA_HEIGHT);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(roadLeft + roadWidth * 0.66, 0);
    ctx.lineTo(roadLeft + roadWidth * 0.66, ARENA_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Player Sports Car (Cyan)
    const px = ARENA_WIDTH * this.racerPlayer.x;
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.fillRect(px - 28, this.racerPlayer.y - 45, 56, 90);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px - 18, this.racerPlayer.y - 15, 36, 40); // windshield
    ctx.shadowBlur = 0;

    // Traffic Cars
    for (const car of this.racerTraffic) {
      const cx = ARENA_WIDTH * car.x;
      ctx.fillStyle = car.color;
      ctx.fillRect(cx - 25, car.y - 40, 50, 80);
    }
  }

  // -------------------------------------------------------------------------
  // 5. VECTOR ASTEROIDS
  // -------------------------------------------------------------------------
  private initVectorAsteroids() {
    this.vectorShip = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, vx: 0, vy: 0, angle: -Math.PI / 2, radius: 18, score: 0, lives: 3 };
    this.vectorRocks = [];
    this.vectorShots = [];
    for (let i = 0; i < 8; i++) {
      this.vectorRocks.push({
        x: Math.random() * ARENA_WIDTH,
        y: Math.random() * ARENA_HEIGHT,
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.5) * 120,
        radius: 40 + Math.random() * 30,
        points: 50,
      });
    }
  }

  private updateVectorAsteroids(dt: number) {
    if (this.vectorShip.lives <= 0) {
      this.status = 'gameover';
      document.body.dataset.state = 'gameover';
      return;
    }

    const rot = this.currentInput.stickX;
    const thrust = this.currentInput.boost || this.currentInput.stickY < -0.3;
    updateVectorShipPhysics(this.vectorShip, rot, thrust, dt);

    // Shoot
    if (this.currentInput.fire && this.vectorShots.length < 5) {
      sound.playLaser(100);
      this.vectorShots.push({
        x: this.vectorShip.x + Math.cos(this.vectorShip.angle) * 25,
        y: this.vectorShip.y + Math.sin(this.vectorShip.angle) * 25,
        vx: Math.cos(this.vectorShip.angle) * 1000,
        vy: Math.sin(this.vectorShip.angle) * 1000,
        life: 0,
      });
    }

    // Hyperspace jump
    if (this.currentInput.bomb) {
      this.vectorShip.x = Math.random() * ARENA_WIDTH;
      this.vectorShip.y = Math.random() * ARENA_HEIGHT;
      this.vectorShip.vx = 0;
      this.vectorShip.vy = 0;
      sound.playBombNova();
    }

    // Update shots
    for (let i = this.vectorShots.length - 1; i >= 0; i--) {
      const s = this.vectorShots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life += dt;
      if (s.life > 1.4) {
        this.vectorShots.splice(i, 1);
        continue;
      }

      // Check hit rock
      for (let j = this.vectorRocks.length - 1; j >= 0; j--) {
        const r = this.vectorRocks[j];
        if (Math.hypot(s.x - r.x, s.y - r.y) < r.radius) {
          this.vectorShots.splice(i, 1);
          this.vectorRocks.splice(j, 1);
          this.vectorShip.score += r.points;
          sound.playExplosion(false);
          if (this.onHapticTrigger) this.onHapticTrigger(1, [60], this.vectorShip.lives, 100, this.vectorShip.score);

          // Split rock
          if (r.radius > 25) {
            this.vectorRocks.push({
              x: r.x - 15,
              y: r.y,
              vx: (Math.random() - 0.5) * 180,
              vy: (Math.random() - 0.5) * 180,
              radius: r.radius / 2,
              points: 100,
            });
            this.vectorRocks.push({
              x: r.x + 15,
              y: r.y,
              vx: (Math.random() - 0.5) * 180,
              vy: (Math.random() - 0.5) * 180,
              radius: r.radius / 2,
              points: 100,
            });
          }
          break;
        }
      }
    }

    // Update rocks
    for (const r of this.vectorRocks) {
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      if (r.x < 0) r.x += ARENA_WIDTH;
      if (r.x > ARENA_WIDTH) r.x -= ARENA_WIDTH;
      if (r.y < 0) r.y += ARENA_HEIGHT;
      if (r.y > ARENA_HEIGHT) r.y -= ARENA_HEIGHT;

      // Check hit ship
      if (Math.hypot(r.x - this.vectorShip.x, r.y - this.vectorShip.y) < r.radius + this.vectorShip.radius) {
        this.vectorShip.lives--;
        this.vectorShip.x = ARENA_WIDTH / 2;
        this.vectorShip.y = ARENA_HEIGHT / 2;
        this.vectorShip.vx = 0;
        this.vectorShip.vy = 0;
        sound.playExplosion(true);
        if (this.onHapticTrigger) this.onHapticTrigger(1, [150, 50, 150], this.vectorShip.lives, 0, this.vectorShip.score);
      }
    }

    if (this.onStatsChange) {
      this.onStatsChange({
        score: this.vectorShip.score,
        health: this.vectorShip.lives,
        shield: 100,
        energy: 100,
        bombCharge: 100,
        wave: 1,
        status: this.status,
        combo: 1,
      });
    }
  }

  private renderVectorAsteroids() {
    const ctx = this.ctx;
    ctx.fillStyle = '#020408';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Vector line aesthetics
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 12;

    // Render Ship
    ctx.save();
    ctx.translate(this.vectorShip.x, this.vectorShip.y);
    ctx.rotate(this.vectorShip.angle);
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-18, -14);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-18, 14);
    ctx.closePath();
    ctx.stroke();

    if (this.currentInput.boost || this.currentInput.stickY < -0.3) {
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-24, 0);
      ctx.stroke();
    }
    ctx.restore();

    // Render Rocks
    ctx.strokeStyle = '#a855f7';
    ctx.shadowColor = '#a855f7';
    for (const r of this.vectorRocks) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Render Shots
    ctx.fillStyle = '#ffffff';
    for (const s of this.vectorShots) {
      ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
    }
    ctx.shadowBlur = 0;
  }

  // -------------------------------------------------------------------------
  // 7. SUPER PLUMBER (Mario 1985 Platformer)
  // -------------------------------------------------------------------------
  public initPlumber(stageId?: PlumberStageId) {
    if (stageId) this.currentPlumberStageId = stageId;
    this.plumberStage = initPlumberStage(this.currentPlumberStageId);
    this.plumberCameraX = 0;
    this.plumberTime = 400;
    this.plumberFireballs = [];
    this.bowserFireballs = [];
    this.plumberParticles = [];
    this.plumberBrickDebris = [];
    this.plumberFireworks = [];
    this.plumberSkidPuffs = [];
    this.plumberStageClear = false;
    this.bowserDefeated = false;
    this.axeActivated = false;
    this.grandFinale = false;
    this.plumberFlagY = 320;
    this.plumberClearTimer = 0;
    this.prevFireInput = false;
  }

  public setPlumberStage(stageId: PlumberStageId) {
    this.initPlumber(stageId);
  }

  public spawnPlumberFireball() {
    if (!this.plumberStage || !this.plumberStage.player) return;
    const p = this.plumberStage.player;
    if (this.plumberFireballs.length >= 2) return; // NES Mario maximum 2 fireballs
    sound.playLaser(200);
    this.plumberFireballs.push({
      x: p.facing > 0 ? p.x + p.w + 6 : p.x - 12,
      y: p.y + p.h * 0.45,
      vx: p.facing * 780,
      vy: 180,
      bounces: 0,
    });
    if (this.onHapticTrigger) this.onHapticTrigger(1, [35], p.lives, 100, p.score);
  }

  public addPlumberFloatingText(x: number, y: number, text: string, color: string) {
    this.plumberParticles.push({
      x,
      y,
      vx: 0,
      vy: -120,
      color,
      life: 0,
      maxLife: 0.9,
      size: 16,
      text,
    });
  }

  private updatePlumber(dt: number) {
    if (!this.plumberStage || !this.plumberStage.player) return;
    const player = this.plumberStage.player;

    // Plumber Death Animation
    if (player.isDead) {
      player.vy += 2200 * dt;
      player.y += player.vy * dt;
      if (player.y > 1250) {
        this.status = 'gameover';
        document.body.dataset.state = 'gameover';
      }
      return;
    }

    // Fireball shooting on Fire / [B] button
    if (this.currentInput.fire && !this.prevFireInput) {
      if (player.form === 'fire') {
        this.spawnPlumberFireball();
      }
    }
    this.prevFireInput = this.currentInput.fire;

    // Time countdown
    this.plumberTime = Math.max(0, this.plumberTime - dt * 2.2);
    if (this.plumberTime <= 0 && !this.plumberStageClear) {
      player.isDead = true;
      player.vy = -750;
      sound.playExplosion(false);
      return;
    }

    // Victory sequence: Flagpole or Bowser Axe reached!
    if (this.plumberStageClear) {
      this.plumberClearTimer += dt;
      // Slide flag down the pole if overworld/athletic
      if (this.plumberFlagY < 810) {
        this.plumberFlagY += 450 * dt;
      }
      // Plumber slides down pole, then walks to the right into the castle
      if (player.y < 824 && this.plumberStage.theme !== 'castle') {
        player.y += 360 * dt;
        player.onGround = false;
      } else if (player.x < this.plumberStage.flagpoleX + 380) {
        player.onGround = true;
        player.x += 180 * dt;
        player.facing = 1;
      }

      // Celebratory Castle Fireworks!
      if (this.plumberClearTimer > 0.8 && Math.random() < 0.28) {
        const castleX = this.plumberStage.flagpoleX + (this.plumberStage.theme === 'castle' ? 0 : 320);
        const fxX = castleX + 40 + Math.random() * 220;
        const fxY = 320 + Math.random() * 260;
        const colors = ['#ef4444', '#facc15', '#38bdf8', '#4ade80', '#ec4899', '#a855f7'];
        const burstColor = colors[Math.floor(Math.random() * colors.length)];
        sound.playBlip(550 + Math.random() * 400, 0.08);

        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2;
          const speed = 120 + Math.random() * 220;
          this.plumberFireworks.push({
            x: fxX,
            y: fxY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: burstColor,
            life: 0,
            maxLife: 0.9,
            size: 4 + Math.random() * 3,
          });
        }
        player.score += 500;
        this.addPlumberFloatingText(fxX, fxY - 20, '+500', burstColor);
      }

      // Automatic Stage Progression
      if (this.plumberClearTimer > 4.6) {
        if (this.currentPlumberStageId === '1-1') {
          this.initPlumber('1-2');
        } else if (this.currentPlumberStageId === '1-2') {
          this.initPlumber('1-3');
        } else if (this.currentPlumberStageId === '1-3') {
          this.initPlumber('1-4');
        } else {
          // World 1-4 Bowser Defeated Grand Finale!
          this.grandFinale = true;
          this.status = 'gameover';
          document.body.dataset.state = 'gameover';
        }
        return;
      }
      return;
    }

    // Check if player grabbed the flagpole or reached end
    if (this.plumberStage.theme !== 'castle') {
      if (player.x >= this.plumberStage.flagpoleX - 30 && !this.plumberStageClear) {
        this.plumberStageClear = true;
        this.plumberClearTimer = 0;
        sound.playFlagpole();
        setTimeout(() => sound.playStageClear(), 600);
        const timeBonus = Math.floor(this.plumberTime) * 50;
        player.score += 5000 + timeBonus;
        player.vx = 0;
        player.vy = 0;
        this.addPlumberFloatingText(player.x, player.y - 40, `STAGE CLEAR! +${5000 + timeBonus} PTS!`, '#4ade80');
        if (this.onHapticTrigger) {
          this.onHapticTrigger(1, [100, 50, 100, 50, 200], player.lives, 100, player.score);
        }
        return;
      }
    }

    // Bowser Fire Breath Spawner in Castle
    if (this.plumberStage.theme === 'castle') {
      for (const en of this.plumberStage.enemies) {
        if (en.type === 'bowser' && en.alive) {
          en.bowserBreathTimer = (en.bowserBreathTimer || 0) + dt;
          if (en.bowserBreathTimer > 2.6) {
            en.bowserBreathTimer = 0;
            sound.playLaser(130);
            this.bowserFireballs.push({
              x: en.x - 10,
              y: en.y + 24,
              vx: -380,
              vy: (Math.random() - 0.5) * 50,
              life: 0,
            });
          }
        }
      }
    }

    // Update Bowser Fireballs
    for (let i = this.bowserFireballs.length - 1; i >= 0; i--) {
      const bfb = this.bowserFireballs[i];
      bfb.life += dt;
      bfb.x += bfb.vx * dt;
      bfb.y += bfb.vy * dt;

      // Check collision with Mario
      if (
        player.x + player.w > bfb.x - 16 &&
        player.x < bfb.x + 16 &&
        player.y + player.h > bfb.y - 14 &&
        player.y < bfb.y + 14
      ) {
        if (!player.isStarman && player.invincibleTimer <= 0) {
          if (player.form === 'super' || player.form === 'fire') {
            player.form = 'small';
            player.h = 56;
            player.invincibleTimer = 2.0;
            sound.playExplosion(false);
          } else {
            player.lives--;
            player.isDead = true;
            sound.playExplosion(false);
          }
        }
        this.bowserFireballs.splice(i, 1);
        continue;
      }

      if (bfb.life > 4.5 || bfb.x < this.plumberCameraX - 100) {
        this.bowserFireballs.splice(i, 1);
      }
    }

    // Skid smoke particles when reversing direction quickly on ground
    if (player.onGround && Math.abs(player.vx) > 280 && Math.sign(player.vx) !== player.facing && Math.random() < 0.4) {
      this.plumberSkidPuffs.push({
        x: player.x + (player.facing > 0 ? -4 : player.w + 4),
        y: player.y + player.h - 4,
        radius: 6,
        life: 0,
        maxLife: 0.35,
      });
    }

    // Standard platformer movement & collision physics
    updatePlumberMovement(
      player,
      this.plumberStage.blocks,
      this.plumberStage.enemies,
      this.currentInput,
      dt,
      {
        onJump: () => {
          sound.playJump();
          if (this.onHapticTrigger) this.onHapticTrigger(1, [30], player.lives, 100, player.score);
        },
        onCoin: () => {
          sound.playCoin();
          this.addPlumberFloatingText(player.x, player.y - 30, '+200', '#facc15');
          if (this.onHapticTrigger) this.onHapticTrigger(1, [40], player.lives, 100, player.score);
        },
        onStomp: () => {
          sound.playStomp();
          this.addPlumberFloatingText(player.x, player.y - 30, '+200', '#38bdf8');
          if (this.onHapticTrigger) this.onHapticTrigger(1, [75], player.lives, 100, player.score);
        },
        onHurt: () => {
          sound.playExplosion(false);
          if (this.onHapticTrigger) this.onHapticTrigger(1, [140, 80, 180], player.lives, 0, player.score);
        },
        onKick: () => {
          sound.playKick();
          if (this.onHapticTrigger) this.onHapticTrigger(1, [50], player.lives, 100, player.score);
        },
        onAxeCut: () => {
          if (!this.axeActivated) {
            this.axeActivated = true;
            this.bowserDefeated = true;
            sound.playBrickBreak();
            sound.playStageClear();
            this.plumberStageClear = true;
            this.plumberClearTimer = 0;
            player.score += 10000;
            this.addPlumberFloatingText(player.x, player.y - 50, 'AXE CUT! 10000 PTS!', '#facc15');
            for (const en of this.plumberStage.enemies) {
              if (en.type === 'bowser') {
                en.alive = false;
              }
            }
          }
        },
        onBrickBreak: (block) => {
          sound.playBrickBreak();
          if (this.onHapticTrigger) this.onHapticTrigger(1, [60], player.lives, 100, player.score);
          const shardVxs = [-240, 240, -150, 150];
          const shardVys = [-680, -680, -450, -450];
          const shardColor = this.plumberStage.theme === 'underground' ? '#0070ec' : this.plumberStage.theme === 'castle' ? '#57534e' : '#c84c0c';
          for (let s = 0; s < 4; s++) {
            this.plumberBrickDebris.push({
              x: block.x + (s % 2) * 25 + 12,
              y: block.y + Math.floor(s / 2) * 25 + 12,
              vx: shardVxs[s],
              vy: shardVys[s],
              rot: Math.random() * Math.PI,
              vRot: (Math.random() - 0.5) * 14,
              color: shardColor,
              life: 0,
              maxLife: 1.2,
            });
          }
        },
        onItemSprout: (item) => {
          sound.playPowerupSprout();
          this.plumberStage.items.push(item);
        },
      },
      this.plumberStage.fireBars
    );

    // Update Items (Mushroom, Fire Flower, Starman, Coin Popups)
    for (let i = this.plumberStage.items.length - 1; i >= 0; i--) {
      const it = this.plumberStage.items[i];
      if (it.collected) {
        this.plumberStage.items.splice(i, 1);
        continue;
      }

      // Emerging animation (rising smoothly out of the block)
      if (it.emerging) {
        it.y -= 70 * dt;
        if (it.y <= it.targetY) {
          it.y = it.targetY;
          it.emerging = false;
        }
        continue;
      }

      // Physics once emerged
      if (it.type === 'mushroom') {
        it.vy += 1800 * dt;
        it.x += it.vx * dt;
        it.y += it.vy * dt;

        // Block / ground collision for sliding mushroom
        for (const b of this.plumberStage.blocks) {
          if (
            it.x + it.w > b.x &&
            it.x < b.x + b.w &&
            it.y + it.h > b.y + 4 &&
            it.y < b.y + b.h - 4
          ) {
            it.vx = -it.vx;
          }
          if (
            it.vy >= 0 &&
            it.x + it.w > b.x + 2 &&
            it.x < b.x + b.w - 2 &&
            it.y + it.h >= b.y &&
            it.y + it.h <= b.y + 24
          ) {
            it.y = b.y - it.h;
            it.vy = 0;
          }
        }
      } else if (it.type === 'star') {
        it.vy += 1600 * dt;
        it.x += it.vx * dt;
        it.y += it.vy * dt;

        for (const b of this.plumberStage.blocks) {
          if (
            it.x + it.w > b.x &&
            it.x < b.x + b.w &&
            it.y + it.h > b.y + 4 &&
            it.y < b.y + b.h - 4
          ) {
            it.vx = -it.vx;
          }
          if (
            it.vy >= 0 &&
            it.x + it.w > b.x &&
            it.x < b.x + b.w &&
            it.y + it.h >= b.y &&
            it.y + it.h <= b.y + 28
          ) {
            it.y = b.y - it.h;
            it.vy = -540;
          }
        }
      }

      // Check pickup overlap with Mario
      const pRight = player.x + player.w;
      const pBottom = player.y + player.h;
      const itRight = it.x + it.w;
      const itBottom = it.y + it.h;

      if (pRight > it.x && player.x < itRight && pBottom > it.y && player.y < itBottom) {
        it.collected = true;
        sound.playPowerup();
        player.score += 1000;

        if (it.type === 'mushroom') {
          player.form = 'super';
          player.h = 76;
          player.y -= 20;
          this.addPlumberFloatingText(player.x, player.y - 40, 'SUPER MARIO! +1000', '#facc15');
          if (this.onHapticTrigger) this.onHapticTrigger(1, [80, 40, 120], player.lives, 100, player.score);
        } else if (it.type === 'fireflower') {
          player.form = 'fire';
          player.h = 76;
          this.addPlumberFloatingText(player.x, player.y - 40, 'FIRE MARIO! +1000', '#ef4444');
          if (this.onHapticTrigger) this.onHapticTrigger(1, [100, 50, 150], player.lives, 100, player.score);
        } else if (it.type === 'star') {
          player.isStarman = true;
          player.starTimer = 12.0;
          this.addPlumberFloatingText(player.x, player.y - 40, 'INVINCIBLE STAR! +1000', '#38bdf8');
          if (this.onHapticTrigger) this.onHapticTrigger(1, [120, 60, 180, 60, 240], player.lives, 100, player.score);
        }
      }

      if (it.y > 1100) {
        it.collected = true;
      }
    }

    // Update Brick Shards
    for (let i = this.plumberBrickDebris.length - 1; i >= 0; i--) {
      const d = this.plumberBrickDebris[i];
      d.life += dt;
      d.vy += 2200 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vRot * dt;
      if (d.life >= d.maxLife || d.y > 1200) {
        this.plumberBrickDebris.splice(i, 1);
      }
    }

    // Update Skid Puffs
    for (let i = this.plumberSkidPuffs.length - 1; i >= 0; i--) {
      const sp = this.plumberSkidPuffs[i];
      sp.life += dt;
      sp.radius += 18 * dt;
      if (sp.life >= sp.maxLife) {
        this.plumberSkidPuffs.splice(i, 1);
      }
    }

    // Update Fireworks
    for (let i = this.plumberFireworks.length - 1; i >= 0; i--) {
      const fw = this.plumberFireworks[i];
      fw.life += dt;
      fw.vy += 450 * dt;
      fw.x += fw.vx * dt;
      fw.y += fw.vy * dt;
      if (fw.life >= fw.maxLife) {
        this.plumberFireworks.splice(i, 1);
      }
    }

    // Fireballs physics and enemy collision
    for (let i = this.plumberFireballs.length - 1; i >= 0; i--) {
      const fb = this.plumberFireballs[i];
      fb.vy += 1800 * dt;
      fb.x += fb.vx * dt;
      fb.y += fb.vy * dt;

      // Bounce off ground and blocks
      for (const b of this.plumberStage.blocks) {
        if (fb.x > b.x && fb.x < b.x + b.w && fb.y + 10 >= b.y && fb.y + 10 <= b.y + 24) {
          fb.y = b.y - 10;
          fb.vy = -460;
          fb.bounces++;
          sound.playBlip(320, 0.04);
          break;
        }
      }

      // Check hit against enemies
      let hitEnemy = false;
      for (const enemy of this.plumberStage.enemies) {
        if (enemy.alive && !enemy.isSquashed) {
          if (fb.x > enemy.x && fb.x < enemy.x + enemy.w && fb.y > enemy.y && fb.y < enemy.y + enemy.h) {
            hitEnemy = true;
            if (enemy.type === 'bowser') {
              enemy.hp = (enemy.hp || 5) - 1;
              sound.playLaser(160);
              this.addPlumberFloatingText(enemy.x + 10, enemy.y - 10, `BOWSER HP: ${enemy.hp}/5`, '#facc15');
              if (enemy.hp <= 0) {
                enemy.alive = false;
                this.bowserDefeated = true;
                player.score += 5000;
                sound.playExplosion(true);
                this.addPlumberFloatingText(enemy.x, enemy.y - 40, 'BOWSER DEFEATED! 5000 PTS', '#4ade80');
              }
            } else {
              enemy.alive = false;
              player.score += 300;
              sound.playStomp();
              this.addPlumberFloatingText(enemy.x, enemy.y - 20, '+300', '#f97316');
            }
            break;
          }
        }
      }

      if (
        hitEnemy ||
        fb.bounces > 4 ||
        fb.y > 1100 ||
        fb.x < this.plumberCameraX - 50 ||
        fb.x > this.plumberCameraX + ARENA_WIDTH + 50
      ) {
        this.plumberFireballs.splice(i, 1);
      }
    }

    // Update floating particles
    for (let i = this.plumberParticles.length - 1; i >= 0; i--) {
      const p = this.plumberParticles[i];
      p.life += dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      if (p.life >= p.maxLife) {
        this.plumberParticles.splice(i, 1);
      }
    }

    // Smooth horizontal camera scrolling following player
    const targetCam = Math.max(0, Math.min(this.plumberStage.flagpoleX - 700, player.x - 480));
    this.plumberCameraX += (targetCam - this.plumberCameraX) * Math.min(1, dt * 8);

    // Notify stats HUD
    if (this.onStatsChange) {
      this.onStatsChange({
        score: player.score,
        health: player.lives,
        shield: Math.max(0, Math.floor(this.plumberTime)),
        energy: player.coins,
        bombCharge: 100,
        wave: player.form === 'fire' ? 3 : player.form === 'super' ? 2 : 1,
        status: this.status,
        combo: player.coins,
      });
    }
  }

  private renderPlumber() {
    const ctx = this.ctx;
    if (!this.plumberStage || !this.plumberStage.player) return;
    const player = this.plumberStage.player;
    const camX = this.plumberCameraX;
    const theme = this.plumberStage.theme || 'overworld';

    // =========================================================================
    // 1. DYNAMIC THEMED BACKGROUNDS
    // =========================================================================
    if (theme === 'overworld') {
      // Classic Bright Blue Super Mario Sky
      ctx.fillStyle = '#5c94fc';
      ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

      // Parallax Distant Clouds
      ctx.fillStyle = '#ffffff';
      const cloudOffsets = [150, 600, 1100, 1600, 2100, 2700, 3400, 4200, 5000];
      for (const cx of cloudOffsets) {
        const screenCx = cx - camX * 0.25;
        if (screenCx > -200 && screenCx < ARENA_WIDTH + 200) {
          const cy = 180 + ((cx * 13) % 120);
          ctx.beginPath();
          ctx.arc(screenCx, cy, 35, 0, Math.PI * 2);
          ctx.arc(screenCx + 30, cy - 15, 45, 0, Math.PI * 2);
          ctx.arc(screenCx + 70, cy - 10, 40, 0, Math.PI * 2);
          ctx.arc(screenCx + 100, cy, 35, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#d4e4fc';
          ctx.fillRect(screenCx - 10, cy + 15, 120, 18);
          ctx.fillStyle = '#ffffff';
        }
      }

      // Parallax Rolling Green Hills
      const hillOffsets = [100, 800, 1500, 2300, 3200, 4100, 5000];
      for (const hx of hillOffsets) {
        const screenHx = hx - camX * 0.45;
        if (screenHx > -300 && screenHx < ARENA_WIDTH + 300) {
          ctx.fillStyle = '#00a800';
          ctx.beginPath();
          ctx.ellipse(screenHx, 880, 220, 160, 0, Math.PI, 0);
          ctx.fill();
          ctx.strokeStyle = '#005800';
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.fillStyle = '#005800';
          ctx.beginPath();
          ctx.arc(screenHx - 40, 780, 14, 0, Math.PI * 2);
          ctx.arc(screenHx + 30, 810, 18, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Parallax Green Bushes
      const bushOffsets = [300, 1000, 1800, 2700, 3600, 4500, 5400];
      for (const bx of bushOffsets) {
        const screenBx = bx - camX * 0.7;
        if (screenBx > -150 && screenBx < ARENA_WIDTH + 150) {
          ctx.fillStyle = '#48c018';
          ctx.beginPath();
          ctx.arc(screenBx, 875, 24, 0, Math.PI * 2);
          ctx.arc(screenBx + 28, 865, 30, 0, Math.PI * 2);
          ctx.arc(screenBx + 56, 875, 24, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#005800';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    } else if (theme === 'underground') {
      // Subterranean Cavern Darkness
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

      // Cavern stalactites hanging in background
      ctx.fillStyle = '#0f172a';
      const stOffsets = [100, 350, 600, 850, 1100, 1400, 1700, 2000, 2400];
      for (const st of stOffsets) {
        const sX = st - camX * 0.3;
        ctx.beginPath();
        ctx.moveTo(sX, 0);
        ctx.lineTo(sX + 30, 160 + (st % 80));
        ctx.lineTo(sX + 60, 0);
        ctx.fill();
      }
    } else if (theme === 'athletic') {
      // Sunset Sky Gradient
      const grad = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
      grad.addColorStop(0, '#312e81');
      grad.addColorStop(0.35, '#831843');
      grad.addColorStop(0.7, '#ea580c');
      grad.addColorStop(1, '#facc15');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

      // Distant mountain ranges
      ctx.fillStyle = 'rgba(76, 29, 149, 0.5)';
      for (let m = 0; m < 8; m++) {
        const mX = m * 600 - camX * 0.2;
        ctx.beginPath();
        ctx.moveTo(mX - 250, 880);
        ctx.lineTo(mX + 150, 480);
        ctx.lineTo(mX + 550, 880);
        ctx.fill();
      }

      // Twilight clouds
      ctx.fillStyle = 'rgba(254, 215, 170, 0.4)';
      for (let c = 0; c < 7; c++) {
        const cX = c * 700 - camX * 0.35;
        ctx.beginPath();
        ctx.arc(cX, 240, 45, 0, Math.PI * 2);
        ctx.arc(cX + 50, 220, 60, 0, Math.PI * 2);
        ctx.arc(cX + 110, 240, 45, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme === 'castle') {
      // Volcanic Dungeon Dark Basalt Walls
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

      // Stone Masonry Pattern in background
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2;
      for (let y = 0; y < 850; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ARENA_WIDTH, y);
        ctx.stroke();
      }

      // Torch sconces on walls with animated flickering flame
      const torchXOffsets = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400, 3800];
      for (const tx of torchXOffsets) {
        const sTx = tx - camX * 0.7;
        if (sTx > -60 && sTx < ARENA_WIDTH + 60) {
          // Iron sconce
          ctx.fillStyle = '#52525b';
          ctx.fillRect(sTx - 4, 620, 8, 28);
          // Flame glow
          const flamePulse = Math.sin(Date.now() / 90 + tx) * 4;
          const torchGrad = ctx.createRadialGradient(sTx, 610, 2, sTx, 610, 24);
          torchGrad.addColorStop(0, '#fef08a');
          torchGrad.addColorStop(0.4, '#f97316');
          torchGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = torchGrad;
          ctx.beginPath();
          ctx.arc(sTx, 610, 24 + flamePulse, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // =========================================================================
    // 2. WORLD GEOMETRY (Camera-translated)
    // =========================================================================
    ctx.save();
    ctx.translate(-camX, 0);

    // Platform Blocks & Ground
    for (const b of this.plumberStage.blocks) {
      if (b.x + b.w < camX - 100 || b.x > camX + ARENA_WIDTH + 100) continue;

      const bounceY = b.bounceTimer ? -Math.sin((b.bounceTimer / 0.15) * Math.PI) * 16 : 0;
      const drawY = b.y + bounceY;

      if (b.type === 'ground') {
        if (theme === 'underground') {
          // Cobalt blue subterranean stone
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(b.x, drawY, b.w, b.h);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(b.x, drawY, b.w, 14);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(b.x, drawY, b.w, b.h);
        } else if (theme === 'castle') {
          // Dark dungeon stone
          ctx.fillStyle = '#27272a';
          ctx.fillRect(b.x, drawY, b.w, b.h);
          ctx.fillStyle = '#3f3f46';
          ctx.fillRect(b.x, drawY, b.w, 12);
          ctx.strokeStyle = '#09090b';
          ctx.lineWidth = 3;
          ctx.strokeRect(b.x, drawY, b.w, b.h);
        } else {
          // Classic brown soil with green grass
          ctx.fillStyle = '#c84c0c';
          ctx.fillRect(b.x, drawY, b.w, b.h);
          ctx.fillStyle = '#00a800';
          ctx.fillRect(b.x, drawY, b.w, 18);
          ctx.fillStyle = '#005800';
          ctx.fillRect(b.x, drawY + 18, b.w, 4);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(b.x, drawY, b.w, b.h);
        }
      } else if (b.type === 'mushroom_platform') {
        // Athletic giant polka-dot mushroom cap & stalk
        const stalkW = 40;
        const stalkX = b.x + b.w / 2 - stalkW / 2;
        // White wooden stalk
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(stalkX, drawY + b.h, stalkW, 900 - drawY - b.h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(stalkX, drawY + b.h, stalkW, 900 - drawY - b.h);

        // Rounded spotted mushroom cap
        const isOrange = Math.floor(b.x / 400) % 2 === 0;
        ctx.fillStyle = isOrange ? '#ea580c' : '#dc2626';
        ctx.beginPath();
        ctx.roundRect(b.x, drawY, b.w, b.h, [20, 20, 10, 10]);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.stroke();

        // White polka dots
        ctx.fillStyle = '#ffffff';
        const dots = Math.floor(b.w / 50);
        for (let d = 0; d < dots; d++) {
          ctx.beginPath();
          ctx.arc(b.x + 25 + d * 45, drawY + b.h / 2, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (b.type === 'lava') {
        // Molten bubbling boiling lava river!
        const lavaGrad = ctx.createLinearGradient(0, drawY, 0, drawY + b.h);
        lavaGrad.addColorStop(0, '#facc15');
        lavaGrad.addColorStop(0.2, '#f97316');
        lavaGrad.addColorStop(0.6, '#dc2626');
        lavaGrad.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = lavaGrad;
        ctx.fillRect(b.x, drawY, b.w, b.h);

        // Animated magma bubbles
        for (let bub = 0; bub < 12; bub++) {
          const bubX = b.x + ((bub * 97 + Date.now() / 30) % b.w);
          const bubY = drawY + 8 + Math.sin(Date.now() / 150 + bub) * 6;
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(bubX, bubY, 5 + (bub % 4), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (b.type === 'bridge') {
        // Bowser's suspended bridge
        ctx.fillStyle = '#b45309';
        ctx.fillRect(b.x, drawY, b.w, b.h);
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(b.x, drawY, b.w, b.h);
        // Planks
        for (let pX = b.x; pX < b.x + b.w; pX += 30) {
          ctx.beginPath();
          ctx.moveTo(pX, drawY);
          ctx.lineTo(pX, drawY + b.h);
          ctx.stroke();
        }
      } else if (b.type === 'axe') {
        // Golden Axe mounted on pedestal!
        // Pedestal
        ctx.fillStyle = '#475569';
        ctx.fillRect(b.x + 10, drawY + 30, 20, 30);
        // Golden Axe head
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(b.x + 15, drawY + 8);
        ctx.lineTo(b.x + 36, drawY + 2);
        ctx.lineTo(b.x + 38, drawY + 28);
        ctx.lineTo(b.x + 15, drawY + 20);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Golden sparkle
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(b.x + 22, drawY + 6, 4, 4);
      } else if (b.type === 'pipe') {
        // Green Warp Pipe
        const lipHeight = 38;
        const lipOverhang = 8;
        const gradLip = ctx.createLinearGradient(b.x - lipOverhang, drawY, b.x + b.w + lipOverhang, drawY);
        gradLip.addColorStop(0, '#005800');
        gradLip.addColorStop(0.2, '#80d010');
        gradLip.addColorStop(0.5, '#00a800');
        gradLip.addColorStop(1, '#004800');
        ctx.fillStyle = gradLip;
        ctx.fillRect(b.x - lipOverhang, drawY, b.w + lipOverhang * 2, lipHeight);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x - lipOverhang, drawY, b.w + lipOverhang * 2, lipHeight);

        const gradStem = ctx.createLinearGradient(b.x, drawY + lipHeight, b.x + b.w, drawY + lipHeight);
        gradStem.addColorStop(0, '#005800');
        gradStem.addColorStop(0.2, '#80d010');
        gradStem.addColorStop(0.5, '#00a800');
        gradStem.addColorStop(1, '#004800');
        ctx.fillStyle = gradStem;
        ctx.fillRect(b.x, drawY + lipHeight, b.w, b.h - lipHeight);
        ctx.strokeRect(b.x, drawY + lipHeight, b.w, b.h - lipHeight);
      } else if (b.type === 'question') {
        // Glowing Gold Question [?] Block
        ctx.fillStyle = '#fc9838';
        ctx.fillRect(b.x, drawY, b.w, b.h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x, drawY, b.w, b.h);
        ctx.fillStyle = '#000000';
        ctx.fillRect(b.x + 4, drawY + 4, 4, 4);
        ctx.fillRect(b.x + b.w - 8, drawY + 4, 4, 4);
        ctx.fillRect(b.x + 4, drawY + b.h - 8, 4, 4);
        ctx.fillRect(b.x + b.w - 8, drawY + b.h - 8, 4, 4);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', b.x + b.w / 2, drawY + b.h / 2);
      } else if (b.type === 'empty_question') {
        ctx.fillStyle = '#a85428';
        ctx.fillRect(b.x, drawY, b.w, b.h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x, drawY, b.w, b.h);
        ctx.fillStyle = '#000000';
        ctx.fillRect(b.x + 4, drawY + 4, 4, 4);
        ctx.fillRect(b.x + b.w - 8, drawY + 4, 4, 4);
        ctx.fillRect(b.x + 4, drawY + b.h - 8, 4, 4);
        ctx.fillRect(b.x + b.w - 8, drawY + b.h - 8, 4, 4);
      } else if (b.type === 'brick') {
        const brickCol = theme === 'underground' ? '#0070ec' : theme === 'castle' ? '#57534e' : '#c84c0c';
        ctx.fillStyle = brickCol;
        ctx.fillRect(b.x, drawY, b.w, b.h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(b.x, drawY, b.w, b.h);
        ctx.beginPath();
        ctx.moveTo(b.x, drawY + b.h / 2);
        ctx.lineTo(b.x + b.w, drawY + b.h / 2);
        ctx.moveTo(b.x + b.w / 2, drawY);
        ctx.lineTo(b.x + b.w / 2, drawY + b.h / 2);
        ctx.stroke();
      }
    }

    // Flagpole in overworld / athletic stages
    if (theme !== 'castle') {
      const fx = this.plumberStage.flagpoleX;
      ctx.fillStyle = '#00a800';
      ctx.fillRect(fx, 280, 12, 600);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(fx, 280, 12, 600);
      ctx.fillStyle = '#fcb800';
      ctx.beginPath();
      ctx.arc(fx + 6, 280, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(fx, this.plumberFlagY);
      ctx.lineTo(fx - 60, this.plumberFlagY + 24);
      ctx.lineTo(fx, this.plumberFlagY + 48);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Peach's Castle
      const castleX = fx + 320;
      const castleY = 620;
      ctx.fillStyle = '#c84c0c';
      ctx.fillRect(castleX, castleY, 260, 260);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeRect(castleX, castleY, 260, 260);
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = '#c84c0c';
        ctx.fillRect(castleX + c * 65, castleY - 30, 45, 30);
        ctx.strokeRect(castleX + c * 65, castleY - 30, 45, 30);
      }
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(castleX + 130, castleY + 170, 40, Math.PI, 0);
      ctx.rect(castleX + 90, castleY + 170, 80, 90);
      ctx.fill();
    } else {
      // In Castle Stage: Princess Peach & Toad chamber behind Bowser!
      const peachX = 4250;
      const peachY = 740;

      // Princess Peach in royal pink gown!
      // Gown
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.moveTo(peachX + 20, peachY + 20);
      ctx.lineTo(peachX + 46, peachY + 76);
      ctx.lineTo(peachX - 6, peachY + 76);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#db2777';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Blonde hair & face
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(peachX + 20, peachY + 14, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(peachX + 20, peachY + 16, 9, 0, Math.PI * 2);
      ctx.fill();

      // Golden Crown
      ctx.fillStyle = '#eab308';
      ctx.fillRect(peachX + 14, peachY - 2, 12, 6);

      // Toad standing next to Peach!
      const toadX = peachX + 70;
      const toadY = peachY + 24;
      // Spotted mushroom hat
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(toadX + 16, toadY + 12, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(toadX + 16, toadY + 6, 7, 0, Math.PI * 2);
      ctx.arc(toadX + 6, toadY + 14, 5, 0, Math.PI * 2);
      ctx.arc(toadX + 26, toadY + 14, 5, 0, Math.PI * 2);
      ctx.fill();

      // Blue vest & body
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(toadX + 6, toadY + 28, 20, 24);

      // Speech banner above Peach & Toad
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.roundRect(peachX - 40, peachY - 60, 240, 44, 8);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('THANK YOU MARIO!', peachX + 80, peachY - 42);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText('YOU SAVED OUR KINGDOM!', peachX + 80, peachY - 24);

      // Floating heart animations
      for (let h = 0; h < 4; h++) {
        const heartY = peachY - 80 - ((Date.now() / 20 + h * 60) % 80);
        const heartX = peachX + 20 + h * 30 + Math.sin(Date.now() / 200 + h) * 10;
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(heartX, heartY, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Revolving Fire Bars
    for (const fb of this.plumberStage.fireBars || []) {
      const segCount = 6;
      const spacing = fb.length / segCount;
      // Central stone hub
      ctx.fillStyle = '#52525b';
      ctx.beginPath();
      ctx.arc(fb.x, fb.y, 10, 0, Math.PI * 2);
      ctx.fill();

      // Flaming balls
      for (let s = 1; s <= segCount; s++) {
        const fx = fb.x + Math.cos(fb.angle) * (s * spacing);
        const fy = fb.y + Math.sin(fb.angle) * (s * spacing);
        const grad = ctx.createRadialGradient(fx, fy, 2, fx, fy, 12);
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(0.5, '#f97316');
        grad.addColorStop(1, '#dc2626');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(fx, fy, 11, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Render Brick Debris Shards
    for (const d of this.plumberBrickDebris) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color;
      ctx.fillRect(-8, -6, 16, 12);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-8, -6, 16, 12);
      ctx.restore();
    }

    // Render Skid Smoke Puffs
    for (const sp of this.plumberSkidPuffs) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * (1 - sp.life / sp.maxLife)})`;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Sprouted Items (Mushroom, Fire Flower, Star)
    for (const it of this.plumberStage.items) {
      if (it.collected) continue;
      if (it.x + it.w < camX - 100 || it.x > camX + ARENA_WIDTH + 100) continue;

      if (it.type === 'mushroom') {
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.ellipse(it.x + it.w / 2, it.y + 16, it.w / 2, 16, 0, Math.PI, 0);
        ctx.lineTo(it.x + it.w, it.y + 24);
        ctx.lineTo(it.x, it.y + 24);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(it.x + it.w / 2, it.y + 12, 7, 0, Math.PI * 2);
        ctx.arc(it.x + 8, it.y + 18, 5, 0, Math.PI * 2);
        ctx.arc(it.x + it.w - 8, it.y + 18, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fde047';
        ctx.fillRect(it.x + 8, it.y + 24, it.w - 16, 16);
        ctx.strokeRect(it.x + 8, it.y + 24, it.w - 16, 16);
        ctx.fillStyle = '#000000';
        ctx.fillRect(it.x + 12, it.y + 28, 3, 7);
        ctx.fillRect(it.x + it.w - 15, it.y + 28, 3, 7);
      } else if (it.type === 'fireflower') {
        const pulse = Math.sin(Date.now() / 80) * 2;
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(it.x + it.w / 2 - 2, it.y + 22, 5, 18);
        ctx.beginPath();
        ctx.ellipse(it.x + 10, it.y + 32, 8, 4, -0.4, 0, Math.PI * 2);
        ctx.ellipse(it.x + it.w - 10, it.y + 32, 8, 4, 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(it.x + it.w / 2, it.y + 14, 16 + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(it.x + it.w / 2, it.y + 14, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(it.x + it.w / 2, it.y + 14, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.fillRect(it.x + it.w / 2 - 3, it.y + 11, 2, 6);
        ctx.fillRect(it.x + it.w / 2 + 1, it.y + 11, 2, 6);
      } else if (it.type === 'star') {
        ctx.save();
        ctx.translate(it.x + it.w / 2, it.y + it.h / 2);
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        for (let s = 0; s < 5; s++) {
          const outerAngle = (s * Math.PI * 2) / 5 - Math.PI / 2;
          const innerAngle = outerAngle + Math.PI / 5;
          const rOuter = 20;
          const rInner = 9;
          if (s === 0) ctx.moveTo(Math.cos(outerAngle) * rOuter, Math.sin(outerAngle) * rOuter);
          else ctx.lineTo(Math.cos(outerAngle) * rOuter, Math.sin(outerAngle) * rOuter);
          ctx.lineTo(Math.cos(innerAngle) * rInner, Math.sin(innerAngle) * rInner);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.fillRect(-4, -4, 2.5, 7);
        ctx.fillRect(1.5, -4, 2.5, 7);
        ctx.restore();
      }
    }

    // Render Enemies
    for (const enemy of this.plumberStage.enemies) {
      if (!enemy.alive) continue;
      if (enemy.x + enemy.w < camX - 100 || enemy.x > camX + ARENA_WIDTH + 100) continue;

      if (enemy.type === 'bowser') {
        // King Bowser Boss
        ctx.save();
        ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
        const facing = enemy.vx > 0 ? 1 : -1;
        ctx.scale(facing, 1);

        // Spiked Green Carapace Shell
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.ellipse(0, 0, enemy.w / 2 - 4, enemy.h / 2 - 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.stroke();

        // White shell spikes
        ctx.fillStyle = '#ffffff';
        const spikeOffsets = [-24, 0, 24];
        for (const spk of spikeOffsets) {
          ctx.beginPath();
          ctx.moveTo(-enemy.w / 2 + 10, spk);
          ctx.lineTo(-enemy.w / 2 - 14, spk - 8);
          ctx.lineTo(-enemy.w / 2 + 6, spk - 16);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Orange Body & Head
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(18, -14, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Red Fiery Mane & Horns
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(10, -38);
        ctx.lineTo(34, -46);
        ctx.lineTo(24, -26);
        ctx.fill();

        // Glowing red eyes
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(24, -20, 6, 8);
        ctx.fillStyle = '#000000';
        ctx.fillRect(28, -18, 3, 5);

        // Sharp claws & snout
        ctx.fillStyle = '#fde047';
        ctx.fillRect(24, -6, 20, 14);
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(24, -6, 20, 14);

        ctx.restore();
      } else if (enemy.type === 'podoboo') {
        // Leaping lava fireball
        ctx.save();
        ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(0.4, '#f97316');
        grad.addColorStop(1, '#dc2626');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        // Flame eyes
        ctx.fillStyle = '#000000';
        ctx.fillRect(-6, -4, 4, 8);
        ctx.fillRect(2, -4, 4, 8);
        ctx.restore();
      } else if (enemy.type === 'paratroopa') {
        // Winged Paratroopa
        ctx.save();
        ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
        const flap = Math.sin((enemy.wingTimer || 0) * 8) * 12;

        // White feathered wings flapping!
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, -10);
        ctx.lineTo(-30, -32 + flap);
        ctx.lineTo(-12, -26 + flap);
        ctx.lineTo(0, -14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Green turtle body
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.ellipse(0, 0, enemy.w / 2 - 2, enemy.h / 2 - 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (enemy.type === 'piranha') {
        if ((enemy.piranhaOffset || 0) > 4) {
          const chomp = Math.sin(Date.now() / 90) * 6;
          ctx.fillStyle = '#16a34a';
          ctx.fillRect(enemy.x + enemy.w / 2 - 4, enemy.y + 24, 8, enemy.h - 24);

          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.arc(enemy.x + enemy.w / 2, enemy.y + 14, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(enemy.x + enemy.w / 2 - 8, enemy.y + 8, 4, 0, Math.PI * 2);
          ctx.arc(enemy.x + enemy.w / 2 + 8, enemy.y + 8, 4, 0, Math.PI * 2);
          ctx.arc(enemy.x + enemy.w / 2, enemy.y + 20, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(enemy.x + 8, enemy.y + 14 - chomp);
          ctx.lineTo(enemy.x + enemy.w - 8, enemy.y + 14 + chomp);
          ctx.lineTo(enemy.x + enemy.w / 2, enemy.y + 14);
          ctx.closePath();
          ctx.fill();
        }
      } else if (enemy.isSquashed) {
        ctx.fillStyle = theme === 'underground' ? '#1e3a8a' : '#9c4000';
        ctx.beginPath();
        ctx.ellipse(enemy.x + enemy.w / 2, enemy.y + enemy.h - 8, enemy.w / 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (enemy.type === 'goomba') {
        const walkWaddle = Math.sin(Date.now() / 100) * 3;
        const gColor = theme === 'underground' ? '#2563eb' : '#9c4000';
        ctx.fillStyle = gColor;
        ctx.beginPath();
        ctx.ellipse(enemy.x + enemy.w / 2, enemy.y + 16, enemy.w / 2, 16, 0, Math.PI, 0);
        ctx.lineTo(enemy.x + enemy.w, enemy.y + 24);
        ctx.lineTo(enemy.x, enemy.y + 24);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fce0a8';
        ctx.fillRect(enemy.x + 8, enemy.y + 22, enemy.w - 16, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(enemy.x + 12, enemy.y + 20, 6, 8);
        ctx.fillRect(enemy.x + enemy.w - 18, enemy.y + 20, 6, 8);
        ctx.fillStyle = '#000000';
        ctx.fillRect(enemy.x + 14, enemy.y + 22, 3, 5);
        ctx.fillRect(enemy.x + enemy.w - 16, enemy.y + 22, 3, 5);

        ctx.fillStyle = '#000000';
        ctx.fillRect(enemy.x + 4 + walkWaddle, enemy.y + 34, 14, 8);
        ctx.fillRect(enemy.x + enemy.w - 18 - walkWaddle, enemy.y + 34, 14, 8);
      } else if (enemy.type === 'koopa') {
        if (enemy.isShell) {
          ctx.save();
          ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
          if (enemy.shellMoving) {
            ctx.rotate(Date.now() / 50);
          }
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.ellipse(0, 0, enemy.w / 2, enemy.h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.fillStyle = '#facc15';
          ctx.fillRect(-enemy.w / 2 + 4, enemy.h / 2 - 8, enemy.w - 8, 6);
          ctx.restore();

          if (enemy.shellMoving) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 2;
            const dir = Math.sign(enemy.vx);
            ctx.beginPath();
            ctx.moveTo(enemy.x - dir * 15, enemy.y + 10);
            ctx.lineTo(enemy.x - dir * 35, enemy.y + 10);
            ctx.moveTo(enemy.x - dir * 10, enemy.y + 25);
            ctx.lineTo(enemy.x - dir * 28, enemy.y + 25);
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.ellipse(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.w / 2 - 2, enemy.h / 2 - 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.fillStyle = '#facc15';
          ctx.fillRect(enemy.x + 4, enemy.y + enemy.h - 14, enemy.w - 8, 8);
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(enemy.x + (enemy.vx > 0 ? enemy.w : 0), enemy.y + 12, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // Render Bowser Fireballs
    for (const bfb of this.bowserFireballs) {
      const grad = ctx.createRadialGradient(bfb.x, bfb.y, 3, bfb.x, bfb.y, 22);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.3, '#f97316');
      grad.addColorStop(0.8, '#dc2626');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bfb.x, bfb.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Player Fireballs
    for (const fb of this.plumberFireballs) {
      const grad = ctx.createRadialGradient(fb.x, fb.y, 2, fb.x, fb.y, 14);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.4, '#f97316');
      grad.addColorStop(1, '#dc2626');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(fb.x, fb.y, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Fireworks
    for (const fw of this.plumberFireworks) {
      ctx.fillStyle = fw.color;
      ctx.beginPath();
      ctx.arc(fw.x, fw.y, fw.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Plumber (Mario)
    if (!player.isDead || Math.floor(Date.now() / 80) % 2 === 0) {
      if (!(player.invincibleTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0)) {
        ctx.save();
        ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
        ctx.scale(player.facing, 1);

        const pw = player.w;
        const ph = player.h;
        const hx = -pw / 2;
        const hy = -ph / 2;

        let capColor = '#dc2626';
        let shirtColor = '#dc2626';
        let overallsColor = '#1d4ed8';
        let buttonColor = '#facc15';

        if (player.form === 'fire') {
          capColor = '#ffffff';
          overallsColor = '#ffffff';
          shirtColor = '#dc2626';
          buttonColor = '#dc2626';
        }

        if (player.isStarman) {
          const rainbow = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899'];
          const rColor = rainbow[Math.floor(Date.now() / 60) % rainbow.length];
          capColor = rColor;
          shirtColor = rColor;
          overallsColor = '#ffffff';
          ctx.shadowColor = rColor;
          ctx.shadowBlur = 18;
        }

        const isSuperOrFire = player.form === 'super' || player.form === 'fire';

        // 1. Cap
        ctx.fillStyle = capColor;
        ctx.fillRect(hx + 4, hy, pw - 8, isSuperOrFire ? 18 : 14);
        ctx.fillRect(hx + 8, hy + (isSuperOrFire ? 8 : 6), pw - 2, isSuperOrFire ? 10 : 8);

        // 2. Face and Nose
        ctx.fillStyle = '#fde047';
        ctx.fillRect(hx + 6, hy + (isSuperOrFire ? 18 : 14), pw - 12, isSuperOrFire ? 18 : 14);
        ctx.fillRect(hx + pw - 8, hy + (isSuperOrFire ? 20 : 16), 6, isSuperOrFire ? 10 : 8);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(hx + pw - 14, hy + (isSuperOrFire ? 20 : 15), 3, 5);

        // 3. Brown Sideburns and Mustache
        ctx.fillStyle = '#78350f';
        ctx.fillRect(hx + 4, hy + (isSuperOrFire ? 18 : 14), 6, 8);
        ctx.fillStyle = '#000000';
        ctx.fillRect(hx + 10, hy + (isSuperOrFire ? 28 : 22), pw - 10, isSuperOrFire ? 8 : 6);

        // 4. Shirt
        ctx.fillStyle = shirtColor;
        ctx.fillRect(hx + 6, hy + (isSuperOrFire ? 36 : 28), pw - 12, isSuperOrFire ? 16 : 12);

        // 5. Overalls
        ctx.fillStyle = overallsColor;
        ctx.fillRect(hx + 8, hy + (isSuperOrFire ? 42 : 32), pw - 16, isSuperOrFire ? 22 : 16);
        ctx.fillStyle = buttonColor;
        ctx.fillRect(hx + 10, hy + (isSuperOrFire ? 44 : 34), 3, 3);
        ctx.fillRect(hx + pw - 14, hy + (isSuperOrFire ? 44 : 34), 3, 3);

        // 6. Gloves / Arms
        ctx.fillStyle = '#ffffff';
        if (!player.onGround) {
          ctx.fillRect(hx + pw - 8, hy - 4, 10, 10);
          ctx.fillRect(hx, hy + (isSuperOrFire ? 32 : 24), 8, 8);
        } else {
          ctx.fillRect(hx + 2, hy + (isSuperOrFire ? 40 : 30), 8, 8);
          ctx.fillRect(hx + pw - 10, hy + (isSuperOrFire ? 40 : 30), 8, 8);
        }

        // 7. Boots with Leg Stride
        ctx.fillStyle = '#78350f';
        if (!player.onGround) {
          ctx.fillRect(hx + 4, hy + ph - 8, 12, 8);
          ctx.fillRect(hx + pw - 16, hy + ph - 8, 12, 8);
        } else if (Math.abs(player.vx) > 10) {
          const runStep = Math.sin(Date.now() / 80) * 6;
          ctx.fillRect(hx + 4 + runStep, hy + ph - 8, 12, 8);
          ctx.fillRect(hx + pw - 16 - runStep, hy + ph - 8, 12, 8);
        } else {
          ctx.fillRect(hx + 4, hy + ph - 8, 13, 8);
          ctx.fillRect(hx + pw - 17, hy + ph - 8, 13, 8);
        }

        ctx.restore();
      }
    }

    // Render Floating Particles (+200, +1000, etc.)
    for (const p of this.plumberParticles) {
      if (p.text) {
        ctx.save();
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = p.color;
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      }
    }

    ctx.restore(); // Restore camera translation

    // =========================================================================
    // 3. CLASSIC SUPER PLUMBER HUD
    // =========================================================================
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, ARENA_WIDTH, 70);

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';

    // MARIO & Score
    ctx.fillText('MARIO', 220, 28);
    ctx.fillStyle = '#fde047';
    ctx.fillText(player.score.toString().padStart(6, '0'), 220, 54);

    // COINS & Count
    ctx.fillStyle = '#ffffff';
    ctx.fillText('COINS', 640, 28);
    ctx.fillStyle = '#facc15';
    ctx.fillText(`★ x ${player.coins.toString().padStart(2, '0')}`, 640, 54);

    // WORLD & STAGE
    ctx.fillStyle = '#ffffff';
    ctx.fillText('WORLD', 1280, 28);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(this.plumberStage.title || 'WORLD 1-1', 1280, 54);

    // TIME
    ctx.fillStyle = '#ffffff';
    ctx.fillText('TIME', 1700, 28);
    ctx.fillStyle = this.plumberTime < 50 ? '#ef4444' : '#fde047';
    ctx.fillText(Math.floor(this.plumberTime).toString().padStart(3, '0'), 1700, 54);

    ctx.restore();
  }

  public render() {
    if (this.activeGame === 'void_horizon') {
      this.voidEngine.render();
    } else if (this.activeGame === 'cyber_snake') {
      this.renderSnake();
    } else if (this.activeGame === 'galactic_invaders') {
      this.renderInvaders();
    } else if (this.activeGame === 'neon_pong') {
      this.renderPong();
    } else if (this.activeGame === 'turbo_racer') {
      this.renderRacer();
    } else if (this.activeGame === 'vector_asteroids') {
      this.renderVectorAsteroids();
    } else if (this.activeGame === 'super_plumber') {
      this.renderPlumber();
    }
  }
}
