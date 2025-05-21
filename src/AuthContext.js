import React, { createContext, useState, useEffect } from 'react';
import { db } from './firebase';
import { ref, get, set } from 'firebase/database';

export const AuthContext = createContext(null);

const ALLOWED = {
  'yanai': 'Yanai',
  'ido': 'Ido',
  'ofek': 'Ofek',
  'megi': 'Megi',
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  const login = async (username) => {
    // Convert to lowercase for case-insensitive comparison
    const lowercaseUsername = username.toLowerCase();
    
    // Check if the username is in the ALLOWED list
    if (!ALLOWED[lowercaseUsername]) {
      return false; // Login failed
    }

    try {
      // Store the properly capitalized name from ALLOWED
      const properUsername = ALLOWED[lowercaseUsername];
      localStorage.setItem('user', properUsername);
      setUser(properUsername);

      // Initialize friends list in localStorage if it doesn't exist
      const storedFriends = localStorage.getItem('friends_list');
      if (!storedFriends) {
        // Get all friends except the current user
        const friendsList = Object.values(ALLOWED).filter(name => name !== properUsername);
        localStorage.setItem('friends_list', JSON.stringify(friendsList));
        
        // Initialize in Firebase
        try {
          const friendsRef = ref(db, 'users/' + properUsername + '/friends');
          await set(friendsRef, friendsList);
        } catch (error) {
          console.error("Firebase error:", error);
          // Continue even if Firebase fails
        }
      }

      return true; // Login successful
    } catch (error) {
      console.error("Error during login:", error);
      return false; // Login failed
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}; 