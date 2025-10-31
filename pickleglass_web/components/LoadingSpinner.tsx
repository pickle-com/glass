import React from 'react';

interface LoadingSpinnerProps {
    text?: string;
    className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ text = 'Loading...', className = '' }) => (
    <div className={`flex flex-col items-center justify-center ${className}`} role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">{text}</p>
    </div>
);

export default LoadingSpinner;
