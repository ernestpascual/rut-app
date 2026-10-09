import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { colors } from '../../design/tokens';

interface Blob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  phase: number;
  speed: number;
  colorStop0: string;
  colorStop1: string;
  colorStop2: string;
}

export const LiquidBlobCanvas: React.FC = () => {
  const { width, height } = useWindowDimensions();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Mouse tracking for subtle fluid reactivity
    let mouseX = w / 2;
    let mouseY = h / 2;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Blob definitions using exact DESIGN.md monochrome palette:
    // Pure black #000000, soft ink #767676, mid ink #cccccc, surface grade #f4f4f4, pure white #ffffff
    const blobs: Blob[] = [
      {
        x: w * 0.35,
        y: h * 0.4,
        vx: 0.35,
        vy: 0.25,
        baseRadius: Math.min(w, h) * 0.38,
        radius: Math.min(w, h) * 0.38,
        phase: 0,
        speed: 0.0018,
        colorStop0: 'rgba(255, 255, 255, 0.45)', // #ffffff Canvas highlight
        colorStop1: 'rgba(204, 204, 204, 0.25)', // #cccccc Ink-mid
        colorStop2: 'rgba(0, 0, 0, 0)',
      },
      {
        x: w * 0.65,
        y: h * 0.45,
        vx: -0.3,
        vy: 0.32,
        baseRadius: Math.min(w, h) * 0.34,
        radius: Math.min(w, h) * 0.34,
        phase: Math.PI * 0.5,
        speed: 0.0022,
        colorStop0: 'rgba(244, 244, 244, 0.38)', // #f4f4f4 Surface grade
        colorStop1: 'rgba(118, 118, 118, 0.22)', // #767676 Ink soft
        colorStop2: 'rgba(0, 0, 0, 0)',
      },
      {
        x: w * 0.5,
        y: h * 0.65,
        vx: 0.25,
        vy: -0.35,
        baseRadius: Math.min(w, h) * 0.42,
        radius: Math.min(w, h) * 0.42,
        phase: Math.PI,
        speed: 0.0015,
        colorStop0: 'rgba(255, 255, 255, 0.35)', // #ffffff
        colorStop1: 'rgba(118, 118, 118, 0.18)', // #767676
        colorStop2: 'rgba(0, 0, 0, 0)',
      },
      {
        x: w * 0.2,
        y: h * 0.7,
        vx: 0.2,
        vy: 0.2,
        baseRadius: Math.min(w, h) * 0.28,
        radius: Math.min(w, h) * 0.28,
        phase: Math.PI * 1.5,
        speed: 0.0025,
        colorStop0: 'rgba(204, 204, 204, 0.32)', // #cccccc
        colorStop1: 'rgba(50, 50, 50, 0.2)',
        colorStop2: 'rgba(0, 0, 0, 0)',
      },
      {
        x: w * 0.8,
        y: h * 0.3,
        vx: -0.22,
        vy: -0.18,
        baseRadius: Math.min(w, h) * 0.3,
        radius: Math.min(w, h) * 0.3,
        phase: Math.PI * 0.8,
        speed: 0.002,
        colorStop0: 'rgba(244, 244, 244, 0.3)', // #f4f4f4
        colorStop1: 'rgba(118, 118, 118, 0.15)',
        colorStop2: 'rgba(0, 0, 0, 0)',
      },
    ];

    let t = 0;

    const render = () => {
      t += 1;
      // Smooth mouse follow
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      // Pure black canvas background (#000000)
      ctx.fillStyle = colors.ink;
      ctx.fillRect(0, 0, w, h);

      // Use screen / lighten blending for ethereal liquid luminescence
      ctx.globalCompositeOperation = 'screen';

      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];

        // Smooth harmonic organic expansion/contraction
        b.radius = b.baseRadius * (1 + Math.sin(t * b.speed + b.phase) * 0.18);

        // Motion update with gentle bounce
        b.x += b.vx + Math.cos(t * b.speed * 0.8 + b.phase) * 0.6;
        b.y += b.vy + Math.sin(t * b.speed * 0.8 + b.phase) * 0.6;

        // Mouse attraction bias
        const dx = mouseX - b.x;
        const dy = mouseY - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 450 && dist > 10) {
          b.x += (dx / dist) * 0.4;
          b.y += (dy / dist) * 0.4;
        }

        // Boundary padding
        const pad = b.radius * 0.5;
        if (b.x < -pad) {
          b.x = -pad;
          b.vx *= -1;
        } else if (b.x > w + pad) {
          b.x = w + pad;
          b.vx *= -1;
        }

        if (b.y < -pad) {
          b.y = -pad;
          b.vy *= -1;
        } else if (b.y > h + pad) {
          b.y = h + pad;
          b.vy *= -1;
        }

        // Draw radial gradient metaball
        const grad = ctx.createRadialGradient(
          b.x,
          b.y,
          0,
          b.x,
          b.y,
          b.radius
        );

        grad.addColorStop(0, b.colorStop0);
        grad.addColorStop(0.45, b.colorStop1);
        grad.addColorStop(1, b.colorStop2);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Reset composite operation
      ctx.globalCompositeOperation = 'source-over';

      // Subtle editorial vignette overlay
      const vignette = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.3,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.8
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container} pointerEvents="none">
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

  // Native mobile fallback: sleek animated gradient circles
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={[styles.nativeBlob, styles.nativeBlob1]} />
      <View style={[styles.nativeBlob, styles.nativeBlob2]} />
      <View style={[styles.nativeBlob, styles.nativeBlob3]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    backgroundColor: colors.ink, // Pure #000000
    zIndex: 0,
  },
  nativeBlob: {
    position: 'absolute',
    borderRadius: 9999,
  },
  nativeBlob1: {
    top: '15%',
    left: '10%',
    width: 320,
    height: 320,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  nativeBlob2: {
    bottom: '20%',
    right: '5%',
    width: 380,
    height: 380,
    backgroundColor: 'rgba(204, 204, 204, 0.1)',
  },
  nativeBlob3: {
    top: '45%',
    left: '30%',
    width: 280,
    height: 280,
    backgroundColor: 'rgba(118, 118, 118, 0.08)',
  },
});
