import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { colors } from '../../design/tokens';

/**
 * GradientWaveCanvas
 *
 * Full-screen gradient wave background inspired by monopo.vn and
 * reactbits.dev/backgrounds/gradient-waves.
 *
 * Features:
 * - Multiple layered sine waves with offset phases
 * - Mouse-reactive wave distortion (parallax-style)
 * - Scroll-reactive: waves compress/shift as user scrolls
 * - Monochrome palette from DESIGN.md
 */

interface WaveLayer {
  amplitude: number;
  frequency: number;
  speed: number;
  phase: number;
  yOffset: number; // 0-1 range, position on screen
  colorTop: string;
  colorBottom: string;
  opacity: number;
}

export const GradientWaveCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const setupAndRender = useCallback(() => {
    if (Platform.OS !== 'web') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let dpr = window.devicePixelRatio || 1;
    let w = window.innerWidth;
    let h = window.innerHeight;

    const setCanvasSize = () => {
      dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    setCanvasSize();

    const handleResize = () => setCanvasSize();
    window.addEventListener('resize', handleResize);

    // Mouse tracking with smooth interpolation
    let mouseX = 0.5;
    let mouseY = 0.5;
    let targetMouseX = 0.5;
    let targetMouseY = 0.5;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX / w;
      targetMouseY = e.clientY / h;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Scroll tracking
    let scrollProgress = 0;
    let targetScrollProgress = 0;

    const handleScroll = () => {
      // Normalize scroll to 0-1 range over first 2 viewports
      targetScrollProgress = Math.min(window.scrollY / (h * 2), 1);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Wave layer definitions — editorial monochrome + #db1215 accent
    const waveLayers: WaveLayer[] = [
      {
        amplitude: 80,
        frequency: 0.003,
        speed: 0.008,
        phase: 0,
        yOffset: 0.45,
        colorTop: 'rgba(244, 244, 244, 0.08)',    // #f4f4f4 surface grade
        colorBottom: 'rgba(0, 0, 0, 0)',
        opacity: 1,
      },
      {
        amplitude: 65,
        frequency: 0.0035,
        speed: 0.01,
        phase: Math.PI * 0.25,
        yOffset: 0.50,
        colorTop: 'rgba(219, 18, 21, 0.12)',      // #db1215 accent — subtle red glow
        colorBottom: 'rgba(0, 0, 0, 0)',
        opacity: 1,
      },
      {
        amplitude: 60,
        frequency: 0.004,
        speed: 0.012,
        phase: Math.PI * 0.4,
        yOffset: 0.55,
        colorTop: 'rgba(204, 204, 204, 0.12)',    // #cccccc ink-mid
        colorBottom: 'rgba(0, 0, 0, 0)',
        opacity: 1,
      },
      {
        amplitude: 50,
        frequency: 0.005,
        speed: 0.015,
        phase: Math.PI * 0.9,
        yOffset: 0.62,
        colorTop: 'rgba(118, 118, 118, 0.15)',    // #767676 ink-soft
        colorBottom: 'rgba(0, 0, 0, 0)',
        opacity: 1,
      },
      {
        amplitude: 45,
        frequency: 0.0055,
        speed: 0.014,
        phase: Math.PI * 1.1,
        yOffset: 0.66,
        colorTop: 'rgba(219, 18, 21, 0.09)',      // #db1215 accent — deeper crimson
        colorBottom: 'rgba(0, 0, 0, 0)',
        opacity: 1,
      },
      {
        amplitude: 40,
        frequency: 0.006,
        speed: 0.018,
        phase: Math.PI * 1.4,
        yOffset: 0.70,
        colorTop: 'rgba(255, 255, 255, 0.06)',    // #ffffff pure canvas
        colorBottom: 'rgba(0, 0, 0, 0)',
        opacity: 1,
      },
      {
        amplitude: 35,
        frequency: 0.0045,
        speed: 0.022,
        phase: Math.PI * 1.8,
        yOffset: 0.78,
        colorTop: 'rgba(204, 204, 204, 0.08)',    // #cccccc
        colorBottom: 'rgba(0, 0, 0, 0)',
        opacity: 1,
      },
    ];

    let t = 0;

    const drawWave = (layer: WaveLayer, time: number) => {
      const mouseInfluenceX = (mouseX - 0.5) * 40;
      const mouseInfluenceY = (mouseY - 0.5) * 25;
      const scrollShift = scrollProgress * 120;
      const scrollAmplitudeDampen = 1 - scrollProgress * 0.5;

      const baseY = h * layer.yOffset + mouseInfluenceY + scrollShift;
      const amp = layer.amplitude * scrollAmplitudeDampen;

      ctx.beginPath();
      ctx.moveTo(0, h);

      // Draw the wave path with sub-pixel resolution
      for (let x = 0; x <= w; x += 2) {
        const normalizedX = x / w;
        // Multiple sine waves for organic feel
        const wave1 = Math.sin(
          x * layer.frequency + time * layer.speed + layer.phase + mouseInfluenceX * 0.02
        );
        const wave2 = Math.sin(
          x * layer.frequency * 1.8 + time * layer.speed * 0.7 + layer.phase * 0.6
        ) * 0.4;
        const wave3 = Math.sin(
          x * layer.frequency * 3.2 + time * layer.speed * 1.3 + layer.phase * 1.5
        ) * 0.15;

        // Mouse proximity distortion
        const distToMouse = Math.abs(normalizedX - mouseX);
        const mouseBulge = Math.exp(-distToMouse * distToMouse * 12) * mouseInfluenceY * 0.8;

        const y = baseY + (wave1 + wave2 + wave3) * amp + mouseBulge;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(w, h);
      ctx.closePath();

      // Gradient fill from wave crest downward
      const gradientStartY = baseY - amp;
      const gradientEndY = h;
      const gradient = ctx.createLinearGradient(0, gradientStartY, 0, gradientEndY);
      gradient.addColorStop(0, layer.colorTop);
      gradient.addColorStop(0.6, layer.colorBottom);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.globalAlpha = layer.opacity;
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const render = () => {
      t += 1;

      // Smooth mouse interpolation
      mouseX += (targetMouseX - mouseX) * 0.03;
      mouseY += (targetMouseY - mouseY) * 0.03;
      scrollProgress += (targetScrollProgress - scrollProgress) * 0.06;

      // Clear with pure black
      ctx.fillStyle = colors.ink;
      ctx.fillRect(0, 0, w, h);

      // Subtle radial ambient glow in the center
      const ambientGlow = ctx.createRadialGradient(
        w * (0.5 + (mouseX - 0.5) * 0.15),
        h * (0.35 + (mouseY - 0.5) * 0.1),
        0,
        w * 0.5,
        h * 0.4,
        Math.max(w, h) * 0.7
      );
      ambientGlow.addColorStop(0, 'rgba(118, 118, 118, 0.12)');
      ambientGlow.addColorStop(0.4, 'rgba(50, 50, 50, 0.06)');
      ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ambientGlow;
      ctx.fillRect(0, 0, w, h);

      // Subtle red accent glow — #db1215
      const redGlow = ctx.createRadialGradient(
        w * (0.55 + (mouseX - 0.5) * 0.1),
        h * (0.6 + (mouseY - 0.5) * 0.08),
        0,
        w * 0.55,
        h * 0.6,
        Math.max(w, h) * 0.5
      );
      redGlow.addColorStop(0, 'rgba(219, 18, 21, 0.07)');
      redGlow.addColorStop(0.5, 'rgba(219, 18, 21, 0.03)');
      redGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = redGlow;
      ctx.fillRect(0, 0, w, h);

      // Use 'lighter' blending for wave luminosity
      ctx.globalCompositeOperation = 'lighter';

      // Draw all wave layers back-to-front
      for (let i = 0; i < waveLayers.length; i++) {
        drawWave(waveLayers[i], t);
      }

      ctx.globalCompositeOperation = 'source-over';

      // Subtle top-edge fade for blending into nav
      const topFade = ctx.createLinearGradient(0, 0, 0, h * 0.15);
      topFade.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
      topFade.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = topFade;
      ctx.fillRect(0, 0, w, h * 0.15);

      // Subtle noise grain overlay for editorial texture
      if (w > 0 && h > 0) {
        const grainAlpha = 0.03;
        ctx.save();
        ctx.globalAlpha = grainAlpha;
        // Lightweight grain: just a few random semi-transparent dots
        for (let i = 0; i < 800; i++) {
          const gx = Math.random() * w;
          const gy = Math.random() * h;
          const gs = Math.random() * 1.5 + 0.5;
          ctx.fillStyle = Math.random() > 0.5
            ? 'rgba(255, 255, 255, 0.5)'
            : 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(gx, gy, gs, gs);
        }
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const cleanup = setupAndRender();
    return cleanup;
  }, [setupAndRender]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { pointerEvents: 'none' }]}>
        {React.createElement('canvas', {
          ref: canvasRef,
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'block',
          },
        })}
      </View>
    );
  }

  // Native mobile fallback: layered gradient views
  return (
    <View style={[styles.container, { pointerEvents: 'none' }]}>
      <View style={[styles.nativeWave, styles.nativeWave1]} />
      <View style={[styles.nativeWave, styles.nativeWave2]} />
      <View style={[styles.nativeWave, styles.nativeWave3]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill as object,
    overflow: 'hidden',
    backgroundColor: colors.ink,
    zIndex: 0,
  },
  nativeWave: {
    position: 'absolute',
    width: '150%',
    left: '-25%',
    borderRadius: 9999,
  },
  nativeWave1: {
    top: '40%',
    height: 200,
    backgroundColor: 'rgba(244, 244, 244, 0.06)',
    transform: [{ rotate: '-3deg' }],
  },
  nativeWave2: {
    top: '55%',
    height: 180,
    backgroundColor: 'rgba(204, 204, 204, 0.08)',
    transform: [{ rotate: '2deg' }],
  },
  nativeWave3: {
    top: '68%',
    height: 160,
    backgroundColor: 'rgba(118, 118, 118, 0.05)',
    transform: [{ rotate: '-1deg' }],
  },
});
