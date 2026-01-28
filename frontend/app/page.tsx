'use client';

import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { Heart, Coins, Trophy, Users, ArrowRight, Sparkles } from 'lucide-react';

export default function HomePage() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <Heart className="h-8 w-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">FOODSHI</span>
            </Link>
            <div className="flex items-center gap-4">
              {user ? (
                <Link href="/feed" className="btn-primary">
                  Go to Feed
                </Link>
              ) : (
                <>
                  <Link href="/login" className="btn-ghost">
                    Log in
                  </Link>
                  <Link href="/signup" className="btn-primary">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Share Food, Earn Rewards
            </h1>
            <p className="text-xl text-primary-100 mb-8">
              Join the Web3 food donation movement. Donate food, earn Karma Points,
              exchange them for $SHARE tokens, and mint exclusive NFT medals.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="btn bg-white text-primary-700 hover:bg-primary-50 text-lg px-8 py-3">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link href="#how-it-works" className="btn border-2 border-white text-white hover:bg-white/10 text-lg px-8 py-3">
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Heart className="h-8 w-8" />}
              title="Donate Food"
              description="Share your surplus food with those in need. Use GPS verification to confirm donations."
            />
            <FeatureCard
              icon={<Sparkles className="h-8 w-8" />}
              title="Earn Karma"
              description="Get Karma Points for every confirmed donation. Points accumulate over time."
            />
            <FeatureCard
              icon={<Coins className="h-8 w-8" />}
              title="Get $SHARE"
              description="Exchange your Karma Points for $SHARE tokens on the Polygon blockchain."
            />
            <FeatureCard
              icon={<Trophy className="h-8 w-8" />}
              title="Mint Medals"
              description="Earn exclusive NFT medals as you reach milestones. Bronze to Platinum tiers!"
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <StatCard number="10K+" label="Food Donations" />
            <StatCard number="5K+" label="Active Donors" />
            <StatCard number="1M+" label="Karma Points Earned" />
            <StatCard number="500+" label="NFT Medals Minted" />
          </div>
        </div>
      </section>

      {/* Medal Tiers */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-4">NFT Medal Tiers</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Unlock exclusive medals as you donate. Each tier requires time, donations, and burning $SHARE tokens.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MedalCard
              tier="Bronze"
              color="bg-amber-600"
              days={30}
              donations={20}
              burn={50}
            />
            <MedalCard
              tier="Silver"
              color="bg-gray-400"
              days={90}
              donations={70}
              burn={150}
            />
            <MedalCard
              tier="Gold"
              color="bg-yellow-500"
              days={180}
              donations={150}
              burn={300}
            />
            <MedalCard
              tier="Platinum"
              color="bg-cyan-400"
              days={365}
              donations={320}
              burn={500}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-600 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Users className="h-16 w-16 mx-auto mb-6 opacity-90" />
          <h2 className="text-3xl font-bold mb-4">Join the Movement</h2>
          <p className="text-xl text-primary-100 mb-8">
            Be part of a community that's fighting food waste and hunger while earning rewards.
          </p>
          <Link href="/signup" className="btn bg-white text-primary-700 hover:bg-primary-50 text-lg px-8 py-3">
            Start Donating Today
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <Heart className="h-6 w-6 text-primary-500" />
              <span className="text-white font-bold">FOODSHI</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/about" className="hover:text-white">About</Link>
              <Link href="/faq" className="hover:text-white">FAQ</Link>
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white">Terms</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} FOODSHI. Built on Polygon.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center p-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-600 mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="text-4xl font-bold text-primary-600 mb-2">{number}</div>
      <div className="text-gray-600">{label}</div>
    </div>
  );
}

function MedalCard({ tier, color, days, donations, burn }: { tier: string; color: string; days: number; donations: number; burn: number }) {
  return (
    <div className="card text-center">
      <div className={`w-20 h-20 rounded-full ${color} mx-auto mb-4 flex items-center justify-center`}>
        <Trophy className="h-10 w-10 text-white" />
      </div>
      <h3 className="text-xl font-bold mb-4">{tier}</h3>
      <div className="space-y-2 text-sm text-gray-600">
        <p>{days} days active</p>
        <p>{donations} donations</p>
        <p>{burn} $SHARE burn</p>
      </div>
    </div>
  );
}
