import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';

interface Customer {
  id: string;
  name: string;
}

interface AuthContextType {
  customer: Customer | null;
  login: (customerId: string, customerName: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const savedCustomer = Cookies.get('customer');
    if (savedCustomer) {
      try {
        const parsedCustomer = JSON.parse(savedCustomer);
        setCustomer(parsedCustomer);
      } catch (error) {
        console.error('Error parsing saved customer:', error);
        Cookies.remove('customer');
      }
    }
  }, []);

  const login = (customerId: string, customerName: string) => {
    const customerInfo = { id: customerId, name: customerName };
    Cookies.set('customer', JSON.stringify(customerInfo), { expires: 7 });
    setCustomer(customerInfo);
  };

  const logout = () => {
    Cookies.remove('customer');
    setCustomer(null);
  };

  return (
    <AuthContext.Provider value={{ customer, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 