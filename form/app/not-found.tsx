import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      padding: '0 16px'
    }}>
      <div style={{
        maxWidth: '600px',
        width: '100%',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Large 404 with minimal styling */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontSize: '180px',
            lineHeight: '1',
            fontWeight: 'bold',
            color: '#d9d9d9',
            margin: '0'
          }}>
            404
          </h1>
        </div>

        {/* Content */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{
            fontSize: '30px',
            fontWeight: '600',
            color: '#0b487b',
            marginBottom: '12px',
            margin: '0 0 12px 0'
          }}>
            Page Not Found
          </h2>
          <p style={{
            fontSize: '18px',
            lineHeight: '1.6',
            color: '#595959',
            margin: '0'
          }}>
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Action */}
        <Link href="/" className="button-primary">
          Visit Home
        </Link>
      </div>
    </div>
  )
}
