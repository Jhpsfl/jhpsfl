import { SignUp } from '@clerk/nextjs'

const appearance = {
  variables: {
    colorPrimary: '#4CAF50',
    colorBackground: '#0d1f0d',
    colorText: '#e8f5e8',
    colorInputBackground: '#0d1a0d',
    colorInputText: '#e8f5e8',
    borderRadius: '12px',
  },
  elements: {
    rootBox: { width: '100%' },
    card: {
      background: 'linear-gradient(160deg, #0d1f0d, #091409)',
      border: '1px solid #1a3a1a',
      borderRadius: '20px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    },
    headerTitle: { color: '#e8f5e8', fontFamily: "'Playfair Display', serif" },
    headerSubtitle: { color: '#7a9a7a' },
    formButtonPrimary: {
      background: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
      boxShadow: '0 4px 20px rgba(76,175,80,0.4)',
    },
    footerActionLink: { color: '#4CAF50' },
    formFieldInput: { background: '#0d1a0d', borderColor: '#1a3a1a', color: '#e8f5e8' },
    socialButtonsIconButton: { borderColor: '#1a3a1a' },
    dividerLine: { background: '#1a3a1a' },
    dividerText: { color: '#5a8a5a' },
  },
}

export default function SignUpPage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(170deg, #050e05 0%, #081808 40%, #050e05 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <SignUp appearance={appearance} />
    </main>
  )
}
