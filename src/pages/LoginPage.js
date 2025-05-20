import React, { useState, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import './LoginPage.css';

const LoginPage = () => {
  const { login } = useContext(AuthContext);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const cardRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const success = login(password);
    if (success) {
      navigate('/hub');
    } else {
      setError(true);
      setPassword('');
      if (cardRef.current) {
        cardRef.current.classList.remove('shake');
        // trigger reflow for animation restart
        void cardRef.current.offsetWidth;
        cardRef.current.classList.add('shake');
      }
    }
  };

  return (
    <div className="login-bg">
      <form className="login-card" ref={cardRef} onSubmit={handleSubmit}>
        <h2 className="login-title">Sign In</h2>
        <input
          type="password"
          className="login-input"
          placeholder="Enter password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(false); }}
          autoFocus
        />
        <button className="login-btn modern-button" type="submit">Enter</button>
        {error && <div className="login-error">Invalid password</div>}
      </form>
    </div>
  );
};

export default LoginPage; 