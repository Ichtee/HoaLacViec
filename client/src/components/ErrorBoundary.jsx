import React from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-red-100 shadow-modal text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Đã xảy ra lỗi không mong muốn</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Trang web gặp sự cố nhỏ khi hiển thị giao diện. Bạn có thể thử tải lại trang hoặc quay về trang chủ.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <RotateCcw className="w-4 h-4" /> Tải lại trang
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Home className="w-4 h-4" /> Về trang chủ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
