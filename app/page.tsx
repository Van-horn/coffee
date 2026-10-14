import About from '@/components/About';
import Delivery from '@/components/Delivery';
import Faq from '@/components/Faq';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import OrderSection from '@/components/OrderSection';
import Range from '@/components/Range';
import Subscription from '@/components/Subscription';
import Week from '@/components/Week';

export default function Home() {
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Week />
        <Range />
        <Subscription />
        <Delivery />
        <About />
        <Faq />
        <OrderSection />
      </main>
      <Footer />
    </>
  );
}
