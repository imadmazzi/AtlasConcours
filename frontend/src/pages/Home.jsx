import React from 'react';
import Hero from '../components/Hero';
import LatestConcours from '../components/LatestConcours';
import LatestEmplois from '../components/LatestEmplois';
import LatestBlog from '../components/LatestBlog';
import FAQ from '../components/FAQ';

export default function Home() {
  return (
    <main>
      <Hero />
      <LatestConcours />
      <LatestEmplois />
      <LatestBlog />
      <FAQ />
      {/* Floating social buttons */}
      <div className="float-btns">
        <a href="https://t.me/atlasconcours" target="_blank" rel="noopener noreferrer" className="float-btn telegram">
          <i className="fa fa-paper-plane"></i>
        </a>
      </div>
    </main>
  );
}
