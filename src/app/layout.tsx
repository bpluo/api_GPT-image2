import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'GPT 图像工坊',
    description: '使用 OpenAI GPT 图像模型生成和编辑图像的交互式工具。',
    icons: {
        icon: '/favicon.svg'
    }
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang='zh-CN' suppressHydrationWarning>
            <body>
                <ThemeProvider attribute='class' defaultTheme='dark' enableSystem={false} disableTransitionOnChange>
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
