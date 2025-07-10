# Contributing to Agent Spotlight

Thank you for your interest in contributing to Agent Spotlight! This project thrives on community contributions.

## 🚀 Quick Start for Contributors

1. **Fork the repository**
2. **Clone your fork**: `git clone https://github.com/harshpreet931/agent-spotlight.git`
3. **Install dependencies**: `npm install`
4. **Start development**: `npm run tauri dev`
5. **Make your changes**
6. **Test thoroughly**
7. **Submit a Pull Request**

## 🛠️ Development Setup

### Prerequisites
- Node.js (v18+)
- Rust (latest stable)
- Google AI API Key

### Environment Setup
```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API key
```

**⚠️ Security Note**: Never commit your API keys to version control. The `.env.local` file is already in `.gitignore` to prevent accidental commits. Keep your API keys secure and use environment variables for sensitive information.

### Running the App
```bash
# Development mode (hot reload)
npm run tauri dev

# Build for production
npm run tauri build
```

## 📝 Contribution Guidelines

### Code Style
- **Frontend**: Follow Next.js/React best practices
- **Backend**: Follow Rust conventions and use `cargo fmt`
- **Commits**: Use conventional commits format

### What We're Looking For
1. **🐛 Bug Fixes**: Help us squash bugs
2. **✨ New Features**: Enhance the core experience
3. **🔧 MCP Servers**: Build integrations for popular tools
4. **📚 Documentation**: Improve guides and examples
5. **🎨 UI/UX**: Make the interface more intuitive

### MCP Server Contributions
Building MCP servers is one of the most valuable contributions! Popular integrations we'd love to see:
- Git operations
- Database connections
- Cloud service APIs
- Development tools
- System utilities

## 🔄 Pull Request Process

1. **Create a feature branch**: `git checkout -b feature/amazing-new-feature`
2. **Make your changes** with clear, focused commits
3. **Add tests** if applicable
4. **Update documentation** if needed
5. **Test on multiple platforms** if possible
6. **Submit PR** with detailed description

### PR Requirements
- [ ] Code compiles without warnings
- [ ] New features include documentation
- [ ] Breaking changes are clearly documented
- [ ] Tests pass (when applicable)

## 🐛 Reporting Issues

When reporting bugs, please include:
- **Operating System** and version
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Console logs** if applicable
- **Screenshots** for UI issues

## 💡 Feature Requests

For new features:
- Check existing issues first
- Describe the problem you're solving
- Propose a solution approach
- Consider backward compatibility

## 🧪 Testing

Currently, testing is primarily manual. We'd welcome contributions to add:
- Unit tests for core functionality
- Integration tests for MCP server communication
- E2E tests for the UI

## 📞 Getting Help

- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Report bugs via GitHub Issues
- **Discord**: [Join our community](https://discord.gg/agent-spotlight)

## 🏆 Recognition

Contributors will be:
- Listed in our README
- Credited in release notes
- Invited to our contributors' Discord channel
- Given priority access to new features

## 📜 Code of Conduct

Be respectful, inclusive, and collaborative. We're all here to build something amazing together.

---

**Ready to contribute? We can't wait to see what you build! 🚀**
