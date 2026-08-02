#!/bin/bash

echo "🚀 Setting up Messenger Platform..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install Nginx
echo "📦 Installing Nginx..."
sudo apt install -y nginx

# Install MySQL
echo "📦 Installing MySQL..."
sudo apt install -y mysql-server

# Install Redis
echo "📦 Installing Redis..."
sudo apt install -y redis-server

# Install ElasticSearch
echo "📦 Installing ElasticSearch..."
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
echo "deb https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list
sudo apt update && sudo apt install -y elasticsearch

# Install project dependencies
echo "📦 Installing project dependencies..."
cd /var/www/messenger/backend && npm install
cd /var/www/messenger/frontend && npm install

# Setup environment
echo "🔧 Setting up environment..."
cp /var/www/messenger/backend/.env.example /var/www/messenger/backend/.env
cp /var/www/messenger/frontend/.env.example /var/www/messenger/frontend/.env

echo "✅ Setup complete!"
echo "Please configure .env files and run migrations"