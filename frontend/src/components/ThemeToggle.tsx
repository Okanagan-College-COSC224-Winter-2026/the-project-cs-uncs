import React from 'react';
import { useTheme } from './ThemeProvider';
import './ThemeToggle.css';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className="ThemeToggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <svg
        className={`ThemeToggle-icon ${theme === 'dark' ? 'rotated' : ''}`}
        viewBox="0 0 24 24"
        width="20"
        height="20"
      >
        {/* White half (left side) */}
        <circle cx="12" cy="12" r="12" fill="#fff" clipPath="url(#leftHalf)" />

        {/* Black half (right side) */}
        <circle cx="12" cy="12" r="12" fill="#000" clipPath="url(#rightHalf)" />

        {/* Clip paths to create the split */}
        <defs>
          <clipPath id="leftHalf">
            <rect x="0" y="0" width="12" height="24" />
          </clipPath>
          <clipPath id="rightHalf">
            <rect x="12" y="0" width="12" height="24" />
          </clipPath>
        </defs>

        {/* Border */}
        <circle
          cx="12"
          cy="12"
          r="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
        />
      </svg>
    </button>
  );
};
