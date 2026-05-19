import React from 'react';
import Hero from '../components/Hero';
import LatestConcours from '../components/LatestConcours';
import LatestEmplois from '../components/LatestEmplois';
import LatestBlog from '../components/LatestBlog';

export default function Home() {
  return (
    <main>
      <Hero />
      <LatestConcours />
      <LatestEmplois />
      <LatestBlog />
      {/* Floating social buttons */}
      <div className="float-btns">
        <a href="https://t.me/Mazzoxcommunity" target="_blank" rel="noopener noreferrer" className="float-btn telegram">
          <i className="fa fa-paper-plane"></i>
        </a>
        <a href="https://wa.me" target="_blank" rel="noreferrer" className="float-btn whatsapp">
          <i className="fa fa-whatsapp"></i>
        </a>
      </div>
    </main>
  );
}
