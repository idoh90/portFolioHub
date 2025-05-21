import React from 'react';
import { useNavigate } from 'react-router-dom';
import './AddOptionButton.css';

const AddOptionButton = ({ disabled = false }) => {
  const navigate = useNavigate();

  return (
    <button 
      className="floating-add-option-btn modern-button" 
      onClick={() => navigate('/new-option')} 
      disabled={disabled}
      title="Add Option"
    >
      ＋
    </button>
  );
};

export default AddOptionButton; 