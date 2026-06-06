import Header from './Header'
import Footer from './Footer'

export default function Layout({ children }) {
  return (
    <>
      <Header />
      <main id="main-content">
        {children}
      </main>
      <Footer />
    </>
  )
}
