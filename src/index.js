import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';

require('./public/favicon.ico');
require('file-loader?name=[name].[ext]!./index.html');

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
