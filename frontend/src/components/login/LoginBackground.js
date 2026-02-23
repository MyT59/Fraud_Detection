import React from 'react';
import { PARTICLES } from './loginData';

const LoginBackground = () => {
  return (
    <div className="login-bg">
      <div className="login-bg-grid" />
      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />
      {PARTICLES.map(p => (
        <div
          key={p.id}
          className="login-particle"
          style={{
            left:            p.left,
            bottom:          '-10px',
            animationDelay:  p.delay,
            animationDuration: p.duration,
            width:           p.size,
            height:          p.size,
          }}
        />
      ))}
    </div>
  );
};

export default LoginBackground;