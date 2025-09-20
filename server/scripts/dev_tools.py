#!/usr/bin/env python3
"""
Development tools for LoreBridge backend.

This script provides convenient commands for code quality checks,
cleanup, and analysis during development.
"""
import subprocess
import sys
from pathlib import Path
from typing import List
import argparse


class DevTools:
    """Development utilities for code quality and maintenance."""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.app_dir = self.project_root / "app"
    
    def run_command(self, command: List[str], description: str) -> bool:
        """Run a command and return success status."""
        print(f"\n🔧 {description}")
        print(f"Running: {' '.join(command)}")
        
        try:
            result = subprocess.run(
                command, 
                cwd=self.project_root,
                capture_output=True,
                text=True
            )
            
            if result.stdout:
                print(result.stdout)
            
            if result.stderr and result.returncode != 0:
                print(f"❌ Error: {result.stderr}")
                return False
            
            print(f"✅ {description} completed successfully")
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"❌ {description} failed: {e}")
            return False
    
    def check_code_quality(self) -> bool:
        """Run all code quality checks."""
        print("🚀 Running comprehensive code quality checks...")
        
        checks = [
            (["uv", "run", "ruff", "check", "app/"], "Linting with Ruff"),
            (["uv", "run", "ruff", "format", "--check", "app/"], "Format checking with Ruff"),
            (["uv", "run", "mypy", "app/"], "Type checking with mypy"),
            (["uv", "run", "bandit", "-r", "app/", "-f", "txt"], "Security analysis with bandit"),
        ]
        
        all_passed = True
        for command, description in checks:
            if not self.run_command(command, description):
                all_passed = False
        
        return all_passed
    
    def fix_code_style(self) -> bool:
        """Automatically fix code style issues."""
        print("🎨 Fixing code style issues...")
        
        fixes = [
            (["uv", "run", "ruff", "check", "--fix", "app/"], "Auto-fixing linting issues"),
            (["uv", "run", "ruff", "format", "app/"], "Formatting code"),
        ]
        
        all_passed = True
        for command, description in fixes:
            if not self.run_command(command, description):
                all_passed = False
        
        return all_passed
    
    def analyze_complexity(self) -> bool:
        """Analyze code complexity."""
        print("📊 Analyzing code complexity...")
        
        analyses = [
            (["uv", "run", "radon", "cc", "app/", "-a"], "Cyclomatic complexity analysis"),
            (["uv", "run", "radon", "mi", "app/"], "Maintainability index"),
            (["uv", "run", "vulture", "app/"], "Dead code detection"),
        ]
        
        all_passed = True
        for command, description in analyses:
            if not self.run_command(command, description):
                all_passed = False
        
        return all_passed
    
    def run_tests(self, coverage: bool = True) -> bool:
        """Run tests with optional coverage."""
        print("🧪 Running tests...")
        
        if coverage:
            command = ["uv", "run", "pytest", "app/tests/", "--cov=app", "--cov-report=term-missing"]
            description = "Running tests with coverage"
        else:
            command = ["uv", "run", "pytest", "app/tests/"]
            description = "Running tests"
        
        return self.run_command(command, description)
    
    def clean_project(self) -> bool:
        """Clean up project artifacts."""
        print("🧹 Cleaning project artifacts...")
        
        # Patterns to clean
        patterns_to_remove = [
            "**/__pycache__",
            "**/*.pyc",
            "**/*.pyo",
            ".coverage",
            "htmlcov/",
            ".pytest_cache/",
            ".ruff_cache/",
            "*.egg-info/",
        ]
        
        removed_count = 0
        for pattern in patterns_to_remove:
            for path in self.project_root.glob(pattern):
                if path.is_file():
                    path.unlink()
                    removed_count += 1
                elif path.is_dir():
                    import shutil
                    shutil.rmtree(path)
                    removed_count += 1
        
        print(f"✅ Cleaned {removed_count} artifacts")
        return True
    
    def setup_pre_commit(self) -> bool:
        """Set up pre-commit hooks."""
        print("🎣 Setting up pre-commit hooks...")
        
        # Create pre-commit config if it doesn't exist
        pre_commit_config = self.project_root / ".pre-commit-config.yaml"
        if not pre_commit_config.exists():
            config_content = """
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.1.9
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.8.0
    hooks:
      - id: mypy
        additional_dependencies: [types-all]
        args: [--ignore-missing-imports]
  
  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.5
    hooks:
      - id: bandit
        args: [-r, app/, -f, txt]
        exclude: ^app/tests/
"""
            pre_commit_config.write_text(config_content.strip())
            print("📝 Created .pre-commit-config.yaml")
        
        # Install pre-commit hooks
        return self.run_command(
            ["uv", "run", "pre-commit", "install"], 
            "Installing pre-commit hooks"
        )
    
    def generate_report(self) -> bool:
        """Generate a comprehensive code quality report."""
        print("📋 Generating code quality report...")
        
        report_file = self.project_root / "code_quality_report.txt"
        
        with open(report_file, "w") as f:
            f.write("# LoreBridge Code Quality Report\n\n")
            
            # Run each analysis and capture output
            analyses = [
                (["uv", "run", "ruff", "check", "app/"], "## Linting Issues"),
                (["uv", "run", "radon", "cc", "app/", "-a"], "## Complexity Analysis"),
                (["uv", "run", "vulture", "app/"], "## Dead Code Detection"),
                (["uv", "run", "bandit", "-r", "app/", "-f", "txt"], "## Security Analysis"),
            ]
            
            for command, section_title in analyses:
                f.write(f"{section_title}\n")
                f.write("=" * len(section_title) + "\n\n")
                
                try:
                    result = subprocess.run(
                        command,
                        cwd=self.project_root,
                        capture_output=True,
                        text=True
                    )
                    f.write(result.stdout or "No issues found.\n")
                    if result.stderr:
                        f.write(f"Errors: {result.stderr}\n")
                except Exception as e:
                    f.write(f"Failed to run analysis: {e}\n")
                
                f.write("\n" + "-" * 50 + "\n\n")
        
        print(f"✅ Report generated: {report_file}")
        return True


def main():
    """Main entry point for development tools."""
    parser = argparse.ArgumentParser(description="LoreBridge development tools")
    parser.add_argument(
        "command",
        choices=[
            "check", "fix", "complexity", "test", "clean", 
            "setup-hooks", "report", "all"
        ],
        help="Command to run"
    )
    parser.add_argument(
        "--no-coverage", action="store_true",
        help="Skip coverage when running tests"
    )
    
    args = parser.parse_args()
    dev_tools = DevTools()
    
    success = True
    
    if args.command == "check":
        success = dev_tools.check_code_quality()
    elif args.command == "fix":
        success = dev_tools.fix_code_style()
    elif args.command == "complexity":
        success = dev_tools.analyze_complexity()
    elif args.command == "test":
        success = dev_tools.run_tests(coverage=not args.no_coverage)
    elif args.command == "clean":
        success = dev_tools.clean_project()
    elif args.command == "setup-hooks":
        success = dev_tools.setup_pre_commit()
    elif args.command == "report":
        success = dev_tools.generate_report()
    elif args.command == "all":
        print("🚀 Running all development checks...")
        success = (
            dev_tools.clean_project() and
            dev_tools.fix_code_style() and
            dev_tools.check_code_quality() and
            dev_tools.analyze_complexity() and
            dev_tools.run_tests(coverage=not args.no_coverage) and
            dev_tools.generate_report()
        )
    
    if success:
        print("\n🎉 All operations completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Some operations failed. Check the output above.")
        sys.exit(1)


if __name__ == "__main__":
    main() 