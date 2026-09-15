/**
 * "For You, Ameera" - Birthday Surprise Orchestration Engine
 * Recipient: Ameera Hidhaya (Turning 20 on September 16)
 */

(function () {
  'use strict';

  // =========================================================================
  // CONFIGURATION & CONSTANTS
  // =========================================================================
  const CONFIG = {
    TRANSITION_MS: 750,
    SLIDE_2_FIREWORKS_DURATION_MS: 5000,
    SLIDE_2_CAKE_BUTTON_DELAY_MS: 8000,
    SLIDE_3_WISH_DURATION_MS: 6000,
    SLIDE_4_AUTO_ADVANCE_DELAY_MS: 6500,
    SLIDE_5_PHOTO_TIMEOUT_MS: 10000,
    TOTAL_PHOTOS: 9,
    TOTAL_BALLOONS: 6
  };

  // State
  const state = {
    currentSlide: 1,
    isTransitioning: false,
    audioPlaying: false,
    audioMuted: false,
    activeAudioTrack: 'track1',
    balloonsPopped: 0,
    currentPhotoIndex: 0,
    photoTimer: null,
    photoTimerStartTime: 0,
    photoTimerAnimFrame: null,
    hasReachedLetterBottom: false
  };

  // DOM Elements
  const slides = document.querySelectorAll('.slide');
  const audioTrack1 = document.getElementById('audio-track1');
  const audioTrack2 = document.getElementById('audio-track2');
  const audioClap = document.getElementById('audio-clap');
  const musicControlContainer = document.getElementById('music-control-container');
  const musicToggleBtn = document.getElementById('music-toggle-btn');
  const musicToggleLabel = document.getElementById('music-toggle-label');
  const musicBars = document.querySelector('.music-bars');

  // Fallback Confetti Engine (Self-contained if canvas-confetti CDN is offline)
  function triggerConfetti(options = {}) {
    if (typeof window.confetti === 'function') {
      try {
        window.confetti(Object.assign({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#e0284f', '#d4af37', '#ffffff', '#8b1538', '#c2185b']
        }, options));
        return;
      } catch (e) {
        console.warn('Canvas confetti error, falling back:', e);
      }
    }
  }

  // Web Audio Fallback Synthesizer for Immediate Auditory Feedback
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSynthChime(freq = 587.33, duration = 0.8) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  function playPopSound() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  }

  // =========================================================================
  // AUDIO CONTROLLER (Track 1, Track 2, Clap, Mute Toggle)
  // =========================================================================
  function initAudioControls() {
    musicToggleBtn.addEventListener('click', () => {
      toggleMusicMute();
    });

    // Ensure audio loops continuously on ALL mobile devices & browsers (iOS Safari, Android Chrome, Vercel)
    [audioTrack1, audioTrack2].forEach((track) => {
      if (!track) return;
      track.loop = true;
      track.playsInline = true;

      // 1. Pre-loop rewind: reset currentTime to 0 BEFORE track reaches literal end
      // This prevents mobile OS/WebKit from transitioning media element into 'ended/paused' state.
      track.addEventListener('timeupdate', function () {
        if (this.duration && this.duration > 2 && this.currentTime >= this.duration - 0.4) {
          this.currentTime = 0;
          if (this.paused && state.audioPlaying && !state.audioMuted) {
            this.play().catch((e) => console.warn('Pre-loop play error:', e));
          }
        }
      });

      // 2. Ended fallback handler
      track.addEventListener('ended', function () {
        this.currentTime = 0;
        if (state.audioPlaying && !state.audioMuted) {
          const p = this.play();
          if (p !== undefined) {
            p.catch((e) => console.warn('Ended loop play error:', e));
          }
        }
      });

      // 3. Unintended pause fallback handler
      track.addEventListener('pause', function () {
        if (state.audioPlaying && !state.audioMuted && this.duration && this.currentTime >= this.duration - 1) {
          this.currentTime = 0;
          this.play().catch(() => {});
        }
      });
    });
  }

  function startBackgroundMusicTrack1() {
    musicControlContainer.classList.remove('hidden');
    state.activeAudioTrack = 'track1';
    state.audioPlaying = true;
    state.audioMuted = false;
    updateMusicUI(true);

    if (!audioTrack1) return;

    audioTrack1.volume = 0.85;
    audioTrack1.loop = true; // Remo Happy Birthday BGM loops continuously
    audioTrack1.muted = false;

    // Do NOT call audioTrack1.load() as it resets loop/WebKit state on mobile
    if (audioTrack1.paused) {
      const playPromise = audioTrack1.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn('Track 1 autoplay blocked or file loading:', error);
          playSynthChime(523.25, 1.2);
        });
      }
    }
  }

  function switchMusicToTrack2() {
    state.activeAudioTrack = 'track1';
    state.audioPlaying = true;

    if (!audioTrack1) return;
    audioTrack1.loop = true;
    audioTrack1.volume = 0.85;

    if (audioTrack1.paused) {
      const p = audioTrack1.play();
      if (p !== undefined) {
        p.catch(err => console.warn('Remo BGM play error:', err));
      }
    }

    updateMusicUI(true);
  }

  function playClapSound() {
    try {
      if (audioClap) {
        audioClap.currentTime = 0;
        audioClap.volume = 0.9;
        const p = audioClap.play();
        if (p !== undefined) {
          p.catch((e) => {
            console.warn('Clap SFX play error:', e);
            playSynthChime(659.25, 0.4);
          });
        }
      } else {
        playSynthChime(659.25, 0.4);
      }
    } catch (e) {
      console.warn('Clap error:', e);
    }
  }

  function toggleMusicMute() {
    state.audioMuted = !state.audioMuted;
    if (audioTrack1) audioTrack1.muted = state.audioMuted;
    if (audioTrack2) audioTrack2.muted = state.audioMuted;

    updateMusicUI(!state.audioMuted);
  }

  function updateMusicUI(isPlaying) {
    if (state.audioMuted) {
      musicBars.classList.remove('playing');
      musicToggleLabel.textContent = 'Music: Muted 🔇';
    } else if (isPlaying) {
      musicBars.classList.add('playing');
      musicToggleLabel.textContent = 'Music: On 🎵';
    } else {
      musicBars.classList.remove('playing');
      musicToggleLabel.textContent = 'Music: Paused ⏸️';
    }
  }

  // =========================================================================
  // SLIDE TRANSITION SYSTEM (600–900ms smooth forward animation)
  // =========================================================================
  function goToSlide(targetSlideNumber) {
    if (state.isTransitioning || targetSlideNumber === state.currentSlide) return;
    if (targetSlideNumber < 1 || targetSlideNumber > 7) return;

    state.isTransitioning = true;
    const currentSlideEl = document.getElementById(`slide-${state.currentSlide}`);
    const nextSlideEl = document.getElementById(`slide-${targetSlideNumber}`);

    // Teardown previous slide tasks
    teardownSlide(state.currentSlide);

    // Fade out current slide
    currentSlideEl.classList.remove('active');
    currentSlideEl.classList.add('exiting');

    setTimeout(() => {
      currentSlideEl.classList.remove('exiting');

      // Activate next slide
      nextSlideEl.classList.add('active');
      state.currentSlide = targetSlideNumber;
      state.isTransitioning = false;

      // Start animations for the newly active slide
      activateSlide(targetSlideNumber);
    }, CONFIG.TRANSITION_MS);
  }

  function teardownSlide(slideNum) {
    if (slideNum === 2) {
      stopFireworks();
    } else if (slideNum === 5) {
      clearTimeout(state.photoTimer);
      if (state.photoTimerAnimFrame) cancelAnimationFrame(state.photoTimerAnimFrame);
      stopDenseHearts();
    } else if (slideNum === 6) {
      stopRosePetalsCanvas();
    }
  }

  function activateSlide(slideNum) {
    switch (slideNum) {
      case 1:
        initSlide1();
        break;
      case 2:
        initSlide2();
        break;
      case 3:
        initSlide3();
        break;
      case 4:
        initSlide4();
        break;
      case 5:
        initSlide5();
        break;
      case 6:
        initSlide6();
        break;
      case 7:
        initSlide7();
        break;
    }
  }

  // =========================================================================
  // SLIDE 1 LOGIC: Landing & Gift Box Pop
  // =========================================================================
  let bokehAnimId = null;
  function initSlide1() {
    startBokehCanvas('bokeh-canvas-slide1');

    const giftTrigger = document.getElementById('gift-box-trigger');
    const giftBox = document.getElementById('gift-box-element');
    const giftLabel = document.getElementById('gift-box-label');

    let giftOpened = false;
    const openGift = () => {
      if (giftOpened) return;
      giftOpened = true;

      // Unlock Audio context & start Track 1
      getAudioContext();
      startBackgroundMusicTrack1();

      // Trigger pop animation
      giftBox.classList.add('popping');
      giftLabel.innerHTML = '<span class="pulse-icon">💖</span> Opening for Ameera...';

      // Confetti burst
      triggerConfetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.65 }
      });
      playSynthChime(659.25, 0.6);

      // Transition to Slide 2 after 1.8s
      setTimeout(() => {
        goToSlide(2);
      }, 1800);
    };

    giftTrigger.addEventListener('click', openGift, { once: true });
    giftTrigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openGift();
      }
    });
  }

  function drawGlowingHeart(ctx, x, y, size, color, alpha, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    if (rotation) ctx.rotate(rotation);
    ctx.beginPath();
    const topCurveHeight = size * 0.3;
    ctx.moveTo(0, topCurveHeight);
    ctx.bezierCurveTo(0, 0, -size / 2, 0, -size / 2, topCurveHeight);
    ctx.bezierCurveTo(-size / 2, (size + topCurveHeight) / 2, 0, size, 0, size);
    ctx.bezierCurveTo(0, size, size / 2, (size + topCurveHeight) / 2, size / 2, topCurveHeight);
    ctx.bezierCurveTo(size / 2, 0, 0, 0, 0, topCurveHeight);
    ctx.fillStyle = `rgba(${color}, ${alpha})`;
    ctx.shadowBlur = 16;
    ctx.shadowColor = `rgba(${color}, 0.85)`;
    ctx.fill();
    ctx.restore();
  }

  function startBokehCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const particles = [];
    for (let i = 0; i < 35; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 12 + 8,
        alpha: Math.random() * 0.5 + 0.25,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: -Math.random() * 0.7 - 0.3,
        rotation: (Math.random() - 0.5) * 0.4,
        rotSpeed: (Math.random() - 0.5) * 0.015,
        color: Math.random() > 0.4 ? '255, 180, 205' : '245, 215, 120'
      });
    }

    function render() {
      ctx.clearRect(0, 0, width, height);
      for (let p of particles) {
        drawGlowingHeart(ctx, p.x, p.y, p.size, p.color, p.alpha, p.rotation);

        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotSpeed;

        if (p.y < -30) {
          p.y = height + 30;
          p.x = Math.random() * width;
        }
        if (p.x < -30) p.x = width + 30;
        if (p.x > width + 30) p.x = -30;
      }
      bokehAnimId = requestAnimationFrame(render);
    }
    render();
  }

  // =========================================================================
  // SLIDE 2 LOGIC: Fireworks (until slide exit) + Floating Heart Balloons + 8s Cake Button
  // =========================================================================
  let fireworksRunning = false;
  let fireworksAnimId = null;
  let fireworksIntervalId = null;

  function initSlide2() {
    // 1. Trigger fireworks across background continuously until next slide
    startFireworks();

    // 2. Start heart-shaped balloons continuously floating upward
    startFloatingHeartBalloons();

    // 3. Button is strictly hidden & absent from layout until exactly 8 seconds
    const btnContainer = document.getElementById('slide2-cake-btn-container');
    btnContainer.innerHTML = ''; // Ensure clean layout

    setTimeout(() => {
      // Check if user is still on slide 2
      if (state.currentSlide !== 2) return;

      const cakeBtn = document.createElement('button');
      cakeBtn.id = 'btn-slide2-cake';
      cakeBtn.className = 'romantic-btn fade-in-up';
      cakeBtn.innerHTML = 'Now it’s time to cut the cake 🎂';
      cakeBtn.setAttribute('aria-label', 'Proceed to cut the cake');

      cakeBtn.addEventListener('click', () => {
        goToSlide(3);
      });

      btnContainer.appendChild(cakeBtn);
    }, CONFIG.SLIDE_2_CAKE_BUTTON_DELAY_MS);
  }

  function startFireworks() {
    const canvas = document.getElementById('fireworks-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    fireworksRunning = true;
    const particles = [];
    const colors = ['#ffd1dc', '#f43f6e', '#d4af37', '#ffffff', '#ff8da1', '#ffe4b5'];

    function createExplosion(x, y) {
      const count = 45;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
        const speed = Math.random() * 5 + 2;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          decay: Math.random() * 0.02 + 0.015,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 3 + 2
        });
      }
    }

    if (fireworksIntervalId) clearInterval(fireworksIntervalId);
    fireworksIntervalId = setInterval(() => {
      if (!fireworksRunning) return;
      const x = Math.random() * (width * 0.8) + width * 0.1;
      const y = Math.random() * (height * 0.45) + height * 0.1;
      createExplosion(x, y);
    }, 450);

    function loop() {
      if (!fireworksRunning && particles.length === 0) return;
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06; // gravity
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      fireworksAnimId = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopFireworks() {
    fireworksRunning = false;
    if (fireworksIntervalId) {
      clearInterval(fireworksIntervalId);
      fireworksIntervalId = null;
    }
    if (fireworksAnimId) cancelAnimationFrame(fireworksAnimId);
    const canvas = document.getElementById('fireworks-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function startFloatingHeartBalloons() {
    const container = document.getElementById('balloons-container-slide2');
    if (!container) return;
    container.innerHTML = '';

    const balloonColors = ['#e0284f', '#f43f6e', '#d4af37', '#ffd1dc', '#c2185b'];

    for (let i = 0; i < 9; i++) {
      const balloon = document.createElement('div');
      balloon.className = 'floating-heart-balloon';

      const leftPos = (i * 11) + (Math.random() * 6);
      const delay = Math.random() * 6;
      const duration = Math.random() * 4 + 7;
      const size = Math.random() * 16 + 32;
      const color = balloonColors[i % balloonColors.length];

      balloon.style.left = `${leftPos}%`;
      balloon.style.animationDelay = `${delay}s`;
      balloon.style.animationDuration = `${duration}s`;

      balloon.innerHTML = `
        <svg class="balloon-svg-heart" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
        <div class="balloon-string-line"></div>
      `;

      container.appendChild(balloon);
    }
  }

  // =========================================================================
  // SLIDE 3 LOGIC: 3-Layer Cake, 6s Full-Screen Wish, Uninterrupted Music
  // =========================================================================
  function initSlide3Decorations() {
    const container = document.getElementById('slide3-floating-decorations');
    if (!container) return;
    container.innerHTML = '';

    const items = [
      { type: 'heart', color: '#e0284f' },
      { type: 'gift', color: '#d4af37' },
      { type: 'heart', color: '#ffd1dc' },
      { type: 'heart', color: '#f43f6e' },
      { type: 'gift', color: '#e0284f' },
      { type: 'heart', color: '#8b1538' },
      { type: 'gift', color: '#ffd1dc' },
      { type: 'heart', color: '#ff758c' },
      { type: 'gift', color: '#d4af37' },
      { type: 'heart', color: '#e0284f' }
    ];

    items.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'floating-deco-item';
      const leftPos = (idx * 10) + (Math.random() * 4);
      const animDuration = 9 + Math.random() * 6;
      const animDelay = Math.random() * 6;
      const size = item.type === 'heart' ? (20 + Math.random() * 12) : (16 + Math.random() * 10);

      el.style.left = `${leftPos}%`;
      el.style.animationDuration = `${animDuration}s`;
      el.style.animationDelay = `${animDelay}s`;
      el.style.fontSize = `${size}px`;

      if (item.type === 'heart') {
        el.innerHTML = `
          <svg width="${size}" height="${size * 1.1}" viewBox="0 0 24 24" fill="${item.color}">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        `;
      } else {
        el.innerHTML = `<span style="display:inline-block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">🎁</span>`;
      }
      container.appendChild(el);
    });
  }

  function initSlide3() {
    initSlide3Decorations();

    const wishModal = document.getElementById('fullscreen-wish-modal');
    const actionContainer = document.getElementById('slide3-action-container');
    const candleFlame = document.getElementById('candle-flame');
    const candleSmoke = document.getElementById('candle-smoke');
    const cuttingKnife = document.getElementById('cutting-knife');
    const cakeSlice = document.getElementById('cake-slice-cut');
    const cakeStage = document.getElementById('cake-stage');
    const statusMsg = document.getElementById('cake-status-message');

    // Reset elements
    if (wishModal) wishModal.classList.remove('active');
    if (actionContainer) actionContainer.innerHTML = '';
    if (candleFlame) candleFlame.style.display = 'block';
    if (candleSmoke) candleSmoke.classList.remove('puffing');
    if (cuttingKnife) cuttingKnife.classList.remove('knife-animate');
    if (cakeSlice) cakeSlice.classList.remove('slide-out');
    if (statusMsg) statusMsg.textContent = '';

    // "Blow the Candle 🕯️" button (appears strictly after 6s full-screen wish)
    const blowBtn = document.createElement('button');
    blowBtn.id = 'btn-blow-candle';
    blowBtn.className = 'romantic-btn fade-in-up';
    blowBtn.innerHTML = 'Blow the Candle 🕯️';
    blowBtn.setAttribute('aria-label', 'Blow the candle and cut the cake');

    let cakeCutDone = false;
    let buttonReady = false;

    function performBlowAndCut() {
      if (cakeCutDone) return;
      cakeCutDone = true;
      if (blowBtn) {
        blowBtn.disabled = true;
        blowBtn.style.opacity = '0.5';
      }

      try {
        // 1. Extinguish candle flame & smoke puff
        if (candleFlame) candleFlame.style.display = 'none';
        if (candleSmoke) candleSmoke.classList.add('puffing');

        // 2. Play knife cut and slice slide out
        if (cuttingKnife) cuttingKnife.classList.add('knife-animate');
        setTimeout(() => {
          if (cakeSlice) cakeSlice.classList.add('slide-out');
        }, 400);

        // 3. Confetti burst with romantic rose, gold, and white palette
        triggerConfetti({
          particleCount: 110,
          spread: 90,
          origin: { y: 0.6 }
        });

        // 4. Play clap sound effect safely
        playClapSound();

        // 5. DO NOT RESET OR SWITCH SONG! The user requested:
        // "after pressing that the song haves been reset soo slove that problem also the song must continue"
        // The background music continues playing seamlessly without interruption!
        if (audioTrack1 && audioTrack1.paused && !state.audioMuted) {
          audioTrack1.play().catch(() => {});
        }
        state.audioPlaying = true;
        updateMusicUI(true);

        // 6. Celebration status
        if (statusMsg) {
          statusMsg.textContent = 'Happy 20th Birthday Ameera! 🎉✨';
        }
      } catch (err) {
        console.warn('Error during cake celebration:', err);
      }

      // 7. Transition to Slide 4 after celebration animation
      setTimeout(() => {
        goToSlide(4);
      }, 3500);
    }

    blowBtn.addEventListener('click', performBlowAndCut);

    if (cakeStage) {
      cakeStage.style.cursor = 'pointer';
      cakeStage.onclick = () => {
        if (buttonReady && !cakeCutDone) {
          performBlowAndCut();
        }
      };
    }

    let wishClosed = false;
    function closeWishModal() {
      if (wishClosed) return;
      wishClosed = true;
      if (wishModal) wishModal.classList.remove('active');
      setTimeout(() => {
        if (state.currentSlide === 3) {
          buttonReady = true;
          if (actionContainer) {
            actionContainer.innerHTML = '';
            actionContainer.appendChild(blowBtn);
          }
        }
      }, 350);
    }

    // Step 1: 500ms after slide entry, display full-screen black wish modal for 6 seconds
    setTimeout(() => {
      if (state.currentSlide !== 3) return;
      if (wishModal) {
        wishModal.classList.add('active');
        wishModal.onclick = closeWishModal;
      }

      // Step 2: Exactly 6 seconds later, close full-screen modal and show "Blow the Candle 🕯️"
      setTimeout(closeWishModal, CONFIG.SLIDE_3_WISH_DURATION_MS);
    }, 500);
  }

  // =========================================================================
  // SLIDE 4 LOGIC: Six Reasons Why I Love You
  // =========================================================================
  function initSlide4() {
    state.balloonsPopped = 0;
    const colLeft = document.getElementById('balloons-col-left');
    const colRight = document.getElementById('balloons-col-right');
    const counterBadge = document.getElementById('reasons-counter-badge');
    const cardTitle = document.getElementById('reason-card-number');
    const cardText = document.getElementById('reason-card-text');
    const advanceNote = document.getElementById('slide4-auto-advance-note');

    colLeft.innerHTML = '';
    colRight.innerHTML = '';
    counterBadge.textContent = `0 of ${CONFIG.TOTAL_BALLOONS} Revealed`;
    cardTitle.textContent = 'Tap a balloon';
    cardText.textContent = 'Every balloon holds a reason why you are so precious, Ameera.';
    advanceNote.textContent = '';

    const reasons = window.AMEERA_REASONS || [
      "Love your heart — the kindness, warmth, and innocence that make you so uniquely you.",
      "I love every little conversation with you because even the simplest words feel special when they come from you.",
      "I love the way you carry yourself — your attitude, character, smile, and everything that is you.",
      "I love the little things about you that nobody else may notice, because those little things are what make me smile when I am in any situation.",
      "I love the memories that we have, the moments we share, and even the moments used to talk with you I secretly wish could last forever.",
      "I miss those beautiful days with you, but more than the memories, I miss having you close to my heart."
    ];

    const finalDedication = window.AMEERA_FINAL_DEDICATION ||
      "You are not just someone I love — you are my happiness, my comfort, my favorite person, and a world of your own to me. No matter how many days pass, my heart will always choose you, love you, and hold you closer than words could ever express 💕";

    const balloonColors = ['#e0284f', '#d4af37', '#c2185b', '#f43f6e', '#8b1538', '#e5a93c'];

    for (let i = 0; i < CONFIG.TOTAL_BALLOONS; i++) {
      const balloonItem = document.createElement('div');
      balloonItem.className = `interactive-balloon-item bob-${(i % 3) + 1}`;
      balloonItem.setAttribute('role', 'button');
      balloonItem.setAttribute('tabindex', '0');
      balloonItem.setAttribute('aria-label', `Pop balloon ${i + 1}`);

      const color = balloonColors[i];

      balloonItem.innerHTML = `
        <svg class="balloon-svg-shape" viewBox="0 0 24 28" fill="${color}">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          <!-- Knot -->
          <polygon points="10,21 14,21 12,23" fill="${color}"/>
          <!-- String -->
          <path d="M12,23 Q15,26 11,28" stroke="rgba(255,255,255,0.5)" stroke-width="1" fill="none"/>
        </svg>
        <div class="balloon-popped-icon">✨</div>
      `;

      const popAction = () => {
        if (balloonItem.classList.contains('popped')) return;

        balloonItem.classList.add('popped');
        playPopSound();
        triggerConfetti({
          particleCount: 30,
          spread: 45,
          origin: { y: 0.5 }
        });

        state.balloonsPopped++;
        counterBadge.textContent = `${state.balloonsPopped} of ${CONFIG.TOTAL_BALLOONS} Revealed`;

        // Update center card with animation
        cardTitle.textContent = `Reason #${i + 1}`;
        cardText.textContent = `"${reasons[i]}"`;

        const cardInner = document.getElementById('reason-card-inner');
        cardInner.style.transform = 'scale(0.96)';
        setTimeout(() => {
          cardInner.style.transform = 'scale(1)';
        }, 150);

        // Check if all 6 balloons have been popped
        if (state.balloonsPopped === CONFIG.TOTAL_BALLOONS) {
          // Keep the 6th reason quote visible for exactly 6 seconds as requested
          setTimeout(() => {
            cardTitle.textContent = "Forever Yours 💕";
            cardText.textContent = finalDedication;
            advanceNote.textContent = 'Unfolding your photo memories in a moment...';
          }, 6000);

          // After 6s of reason quote + 5.5s of final dedication, advance to Slide 5
          setTimeout(() => {
            if (state.currentSlide === 4) {
              goToSlide(5);
            }
          }, 11500);
        }
      };

      balloonItem.addEventListener('click', popAction);
      balloonItem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          popAction();
        }
      });

      if (i < 3) {
        colLeft.appendChild(balloonItem);
      } else {
        colRight.appendChild(balloonItem);
      }
    }
  }

  // =========================================================================
  // SLIDE 5 LOGIC: Photo Memory Gallery (8 Photos, Shower of Hearts)
  // =========================================================================
  let denseHeartsAnimId = null;

  function initSlide5() {
    startDenseHeartsCanvas('dense-hearts-canvas');

    state.currentPhotoIndex = 0;
    const polaroidWrapper = document.getElementById('polaroid-wrapper');
    const finalBtnContainer = document.getElementById('gallery-final-btn-container');
    finalBtnContainer.innerHTML = '';

    renderPhoto(state.currentPhotoIndex);
    startPhotoTimer();

    // User tap advances immediately
    polaroidWrapper.onclick = () => {
      advancePhoto();
    };
  }

  function renderPhoto(index) {
    const photoImg = document.getElementById('gallery-photo-img');
    const quoteText = document.getElementById('gallery-photo-quote');
    const counterTag = document.getElementById('gallery-counter-tag');
    const quotes = window.AMEERA_QUOTES || [
      "These words written about you are not just poetry, but the truth of my heart. You deserve everything said here.",
      "While you are filmed the moving metro, you unknowingly became the most beautiful scene in the frame.",
      "May every image on this board turn into a chapter of your life, and may reality be even more beautiful than your dreams.",
      "Even from behind,you carried the kind of beauty that stays with you long after the moment is gone",
      "Your face remained a mystery, but your beauty felt certain -as certain as the moon finding its way through the night.",
      "In every new thread you weave and skill you learn, your patience and creativity create quiet magic.",
      "The henna on your hands tells a story of grace, but your gentle touch is what truly warms my soul.",
      "Surrounded by emerald green leaves, even from behind, your presence brings all the peace in the world.",
      "The gift you gave me wasn’t wrapped in paper--it was your presence, and that’s the greatest gift I’ve ever received."
    ];

    photoImg.style.opacity = '0.3';
    photoImg.style.transform = 'scale(0.98)';

    setTimeout(() => {
      photoImg.src = `assets/images/photo${index + 1}.jpg`;
      quoteText.textContent = `"${quotes[index]}"`;
      counterTag.textContent = `${index + 1} of ${CONFIG.TOTAL_PHOTOS}`;

      photoImg.onload = () => {
        photoImg.style.opacity = '1';
        photoImg.style.transform = 'scale(1)';
      };
      // In case image was cached
      photoImg.style.opacity = '1';
      photoImg.style.transform = 'scale(1)';
    }, 180);

    // If 9th photo reached, wait strictly 5 seconds before revealing the button
    if (index === CONFIG.TOTAL_PHOTOS - 1) {
      setTimeout(() => {
        showGalleryFinalButton();
      }, 5000);
    }
  }

  function advancePhoto() {
    clearTimeout(state.photoTimer);
    if (state.photoTimerAnimFrame) cancelAnimationFrame(state.photoTimerAnimFrame);

    if (state.currentPhotoIndex < CONFIG.TOTAL_PHOTOS - 1) {
      state.currentPhotoIndex++;
      renderPhoto(state.currentPhotoIndex);
      startPhotoTimer();
    } else {
      showGalleryFinalButton();
    }
  }

  function startPhotoTimer() {
    if (state.currentPhotoIndex >= CONFIG.TOTAL_PHOTOS - 1) return;

    const timerBar = document.getElementById('gallery-timer-bar');
    state.photoTimerStartTime = performance.now();

    function updateProgress(now) {
      const elapsed = now - state.photoTimerStartTime;
      const progress = Math.min(1, elapsed / CONFIG.SLIDE_5_PHOTO_TIMEOUT_MS);
      if (timerBar) {
        timerBar.style.width = `${progress * 100}%`;
      }

      if (progress < 1) {
        state.photoTimerAnimFrame = requestAnimationFrame(updateProgress);
      }
    }
    state.photoTimerAnimFrame = requestAnimationFrame(updateProgress);

    state.photoTimer = setTimeout(() => {
      advancePhoto();
    }, CONFIG.SLIDE_5_PHOTO_TIMEOUT_MS);
  }

  function showGalleryFinalButton() {
    const finalBtnContainer = document.getElementById('gallery-final-btn-container');
    if (finalBtnContainer.children.length > 0) return;

    const btn = document.createElement('button');
    btn.id = 'btn-to-letter';
    btn.className = 'romantic-btn fade-in-up';
    btn.innerHTML = 'A special surprise for you 💌';
    btn.setAttribute('aria-label', 'A special surprise for you');

    btn.addEventListener('click', () => {
      goToSlide(6);
    });

    finalBtnContainer.appendChild(btn);
  }

  function startDenseHeartsCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const hearts = [];
    const heartColors = ['#ffd1dc', '#f43f6e', '#e0284f', '#ffb6c1', '#d4af37'];

    // Dense shower: 45 hearts rising
    for (let i = 0; i < 45; i++) {
      hearts.push({
        x: Math.random() * width,
        y: Math.random() * height + height,
        size: Math.random() * 14 + 10,
        speedY: Math.random() * 1.5 + 1.2,
        driftX: (Math.random() - 0.5) * 0.8,
        alpha: Math.random() * 0.6 + 0.3,
        color: heartColors[Math.floor(Math.random() * heartColors.length)],
        rotation: Math.random() * 0.5 - 0.25
      });
    }

    function drawHeart(x, y, size, color, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      const topCurveHeight = size * 0.3;
      ctx.moveTo(0, topCurveHeight);
      ctx.bezierCurveTo(0, 0, -size / 2, 0, -size / 2, topCurveHeight);
      ctx.bezierCurveTo(-size / 2, (size + topCurveHeight) / 2, 0, size, 0, size);
      ctx.bezierCurveTo(0, size, size / 2, (size + topCurveHeight) / 2, size / 2, topCurveHeight);
      ctx.bezierCurveTo(size / 2, 0, 0, 0, 0, topCurveHeight);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      ctx.fill();
      ctx.restore();
    }

    function loop() {
      ctx.clearRect(0, 0, width, height);
      for (let h of hearts) {
        drawHeart(h.x, h.y, h.size, h.color, h.alpha);
        h.y -= h.speedY;
        h.x += h.driftX;

        if (h.y < -30) {
          h.y = height + 30;
          h.x = Math.random() * width;
        }
      }
      denseHeartsAnimId = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopDenseHearts() {
    if (denseHeartsAnimId) cancelAnimationFrame(denseHeartsAnimId);
  }

  // =========================================================================
  // SLIDE 6 LOGIC: The Love Letter (With 3D Romantic Envelope)
  // =========================================================================
  let rosePetalsAnimId = null;

  function initSlide6() {
    try {
      startRosePetalsCanvas('slide6-petals-canvas');
    } catch (err) {
      console.warn('Rose petals canvas start:', err);
    }

    const envelopeWrapper = document.getElementById('envelope-box-wrapper');
    const envelopeInteractive = document.getElementById('envelope-interactive');
    const openBtn = document.getElementById('btn-open-envelope');
    const scrollWrapper = document.getElementById('letter-scroll-wrapper');
    const continueBtn = document.getElementById('btn-letter-continue');
    const letterBody = document.getElementById('letter-body-content');

    // Reset initial envelope state
    const slide6El = document.getElementById('slide-6');
    if (slide6El) {
      slide6El.classList.remove('letter-mode-opened');
      slide6El.scrollTop = 0;
    }
    if (envelopeWrapper) {
      envelopeWrapper.classList.remove('opened');
      envelopeWrapper.style.display = 'flex';
    }
    if (scrollWrapper) {
      scrollWrapper.classList.add('hidden');
      scrollWrapper.classList.remove('unfolded');
    }

    // Dynamic fetch fallback from assets/data/letter.txt
    try {
      fetch('assets/data/letter.txt')
        .then((res) => {
          if (res.ok) return res.text();
          throw new Error('Fallback');
        })
        .then((text) => {
          if (text && text.trim().length > 30) {
            formatLetterParagraphs(text.trim(), letterBody);
          }
        })
        .catch(() => {
          // Fallback already in HTML
        });
    } catch (e) {}

    let envelopeOpened = false;
    function openLetterEnvelope() {
      if (envelopeOpened) return;
      envelopeOpened = true;

      // 1. Play soft audio chime & celebration confetti burst
      try {
        playSynthChime(659.25, 0.5);
        triggerConfetti({
          particleCount: 75,
          spread: 80,
          origin: { y: 0.55 },
          colors: ['#e0284f', '#d4af37', '#ffd1dc', '#ffffff', '#8b1538']
        });
      } catch (e) {}

      // 2. Animate envelope flap and peeking letter
      const flapGroup = document.getElementById('svg-flap-group');
      const peekGroup = document.getElementById('svg-letter-peek-group');
      if (flapGroup) {
        flapGroup.style.transition = 'transform 0.6s ease, opacity 0.4s ease';
        flapGroup.style.transformOrigin = '170px 25px';
        flapGroup.style.transform = 'scaleY(-1)';
        flapGroup.style.opacity = '0.3';
      }
      if (peekGroup) {
        peekGroup.style.transition = 'transform 0.7s cubic-bezier(0.2, 0.8, 0.3, 1)';
        peekGroup.style.transform = 'translateY(-65px)';
      }

      // 3. Smooth transition to full letter
      setTimeout(() => {
        if (envelopeWrapper) {
          envelopeWrapper.classList.add('opened');
        }

        setTimeout(() => {
          if (envelopeWrapper) {
            envelopeWrapper.style.display = 'none';
          }
          if (scrollWrapper) {
            scrollWrapper.classList.remove('hidden');
            scrollWrapper.classList.add('unfolded');
          }
          const s6 = document.getElementById('slide-6');
          if (s6) {
            s6.classList.add('letter-mode-opened');
            s6.scrollTop = 0;
          }
        }, 350);
      }, 600);
    }

    if (openBtn) {
      openBtn.onclick = openLetterEnvelope;
    }
    if (envelopeInteractive) {
      envelopeInteractive.onclick = openLetterEnvelope;
      envelopeInteractive.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLetterEnvelope();
        }
      };
    }

    if (continueBtn) {
      continueBtn.onclick = () => {
        goToSlide(7);
      };
    }
  }

  function formatLetterParagraphs(rawText, container) {
    if (!container) return;
    const paras = rawText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    if (paras.length === 0) return;

    let html = '';
    paras.forEach((p, idx) => {
      const isLead = idx === 0;
      html += `<p class="letter-paragraph ${isLead ? 'letter-lead-indent' : ''}">${p.replace(/\n/g, '<br>')}</p>`;
    });
    container.innerHTML = html;
  }

  function startRosePetalsCanvas(canvasId) {
    try {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      let width = (canvas.width = window.innerWidth);
      let height = (canvas.height = window.innerHeight);

      const onResize = () => {
        if (!canvas) return;
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      };
      window.addEventListener('resize', onResize);

      const petals = [];
      const petalColors = ['#e0284f', '#b5183a', '#8b1538', '#ff758c', '#d4af37'];

      for (let i = 0; i < 28; i++) {
        petals.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: 12 + Math.random() * 10,
          speedY: 1.0 + Math.random() * 1.5,
          driftX: (Math.random() - 0.5) * 1.5,
          color: petalColors[Math.floor(Math.random() * petalColors.length)],
          alpha: 0.35 + Math.random() * 0.45,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.03
        });
      }

      function loop() {
        ctx.clearRect(0, 0, width, height);
        for (const p of petals) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.6, p.size, 0, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
          ctx.restore();

          p.y += p.speedY;
          p.x += p.driftX;
          p.rotation += p.rotSpeed;

          if (p.y > height + 30) {
            p.y = -20;
            p.x = Math.random() * width;
          }
        }
        rosePetalsAnimId = requestAnimationFrame(loop);
      }
      loop();
    } catch (e) {
      console.warn('Rose petals error:', e);
    }
  }

  function stopRosePetalsCanvas() {
    if (rosePetalsAnimId) {
      cancelAnimationFrame(rosePetalsAnimId);
      rosePetalsAnimId = null;
    }
  }

  // =========================================================================
  // SLIDE 7 LOGIC: Thank You (Closing)
  // =========================================================================
  function initSlide7() {
    startBokehCanvas('closing-canvas');

    // Sweet celebration confetti shower
    setTimeout(() => {
      triggerConfetti({
        particleCount: 80,
        spread: 120,
        origin: { y: 0.5 }
      });
    }, 500);
  }

  // =========================================================================
  // INITIALIZATION ON DOM READY
  // =========================================================================
  window.addEventListener('DOMContentLoaded', () => {
    initAudioControls();
    activateSlide(1);
  });

})();
