import React from 'react'
import './Modal.css'

export default function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="ModalOverlay" role="dialog" aria-modal="true">
      <div className="ModalContent">
        {children}
      </div>
      <div className="ModalBackdrop" onClick={onClose} />
    </div>
  )
}
