import React, { useRef, useEffect, useState } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, className = '' }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    // Get all focusable elements within the modal
    const getFocusableElements = (): NodeListOf<HTMLElement> | null => {
        if (!modalRef.current) return null;
        return modalRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        );
    };

    // Handle tab key for focus trapping
    const handleTabKey = (event: KeyboardEvent) => {
        if (event.key !== 'Tab') return;

        const focusableElements = getFocusableElements();
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
            // Shift + Tab: moving backwards
            if (document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            }
        } else {
            // Tab: moving forwards
            if (document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    };

    // Handle keyboard events
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            } else if (event.key === 'Tab') {
                handleTabKey(event);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose, handleTabKey]);

    // Handle click outside modal
    const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
            onClose();
        }
    };

    // Animation and render management
    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            // Small delay to ensure DOM is ready before starting animation
            setTimeout(() => setIsAnimating(true), 10);
        } else {
            setIsAnimating(false);
            // Wait for animation to complete before unmounting
            const timer = setTimeout(() => setShouldRender(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Focus management
    useEffect(() => {
        if (isOpen && isAnimating) {
            // Store the previously focused element
            previousFocusRef.current = document.activeElement as HTMLElement;
            
            // Focus the first focusable element in the modal
            const focusableElements = getFocusableElements();
            if (focusableElements && focusableElements.length > 0) {
                focusableElements[0].focus();
            } else if (modalRef.current) {
                // Fallback: focus the modal container itself
                modalRef.current.focus();
            }
        } else if (!isOpen && previousFocusRef.current) {
            // Restore focus to the previously focused element when modal closes
            try {
                previousFocusRef.current.focus();
            } catch (error) {
                // Element might no longer exist, focus body as fallback
                document.body.focus();
            }
            previousFocusRef.current = null;
        }
    }, [isOpen, isAnimating]);

    if (!shouldRender) return null;

    return (
        <div 
            className={`fixed inset-0 bg-black flex justify-center items-center z-50 transition-opacity duration-200 ${
                isAnimating ? 'bg-opacity-70' : 'bg-opacity-0'
            }`} 
            onClick={handleOverlayClick}
        >
            <div
                ref={modalRef}
                className={`bg-white rounded-lg shadow-xl w-[90%] max-w-2xl max-h-[90vh] flex flex-col overflow-hidden transition-all duration-200 transform ${
                    isAnimating 
                        ? 'scale-100 opacity-100 translate-y-0' 
                        : 'scale-95 opacity-0 translate-y-4'
                } ${className}`}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Modal Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h2 id="modal-title" className="text-xl font-semibold text-gray-900">
                        {title}
                    </h2>
                    <button className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-2 -m-2" onClick={onClose} aria-label="Close modal">
                        ×
                    </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 p-6 overflow-y-auto">{children}</div>

                {/* Modal Footer */}
                {footer && <div className="flex justify-end gap-3 p-6 border-t border-gray-200">{footer}</div>}
            </div>
        </div>
    );
};

export default Modal;
