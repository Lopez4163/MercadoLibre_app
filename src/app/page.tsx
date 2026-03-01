export default function HomePage() {
  const ML_AUTH_URL = `https://auth.mercadolibre.com.co/authorization?response_type=code&client_id=${process.env.NEXT_PUBLIC_ML_CLIENT_ID}&redirect_uri=${process.env.NEXT_PUBLIC_ML_REDIRECT_URI}`

  return <main>
    <div>
      <a href={ML_AUTH_URL}>Connect Mercado Libre</a>
    </div>
  </main>;
}
