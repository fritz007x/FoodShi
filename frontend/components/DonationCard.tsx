'use client';

import Link from 'next/link';
import { MapPin, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatRelativeTime, getInitials, cn } from '@/lib/utils';

interface Donation {
  id: string;
  description: string;
  photo_url?: string;
  status: 'pending' | 'confirmed' | 'disputed' | 'expired' | 'cancelled';
  points_awarded: number;
  latitude: number;
  longitude: number;
  created_at: string;
  challenge_deadline?: string;
  donor_id: string;
  donor_name?: string;
  donor_pic?: string;
  receiver_id?: string;
  receiver_name?: string;
  receiver_pic?: string;
}

interface DonationCardProps {
  donation: Donation;
  showActions?: boolean;
  onConfirm?: () => void;
  onDispute?: () => void;
}

const statusConfig = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock,
  },
  confirmed: {
    label: 'Confirmed',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
  },
  disputed: {
    label: 'Disputed',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
  },
  expired: {
    label: 'Expired',
    color: 'bg-gray-100 text-gray-800',
    icon: AlertCircle,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-gray-100 text-gray-800',
    icon: XCircle,
  },
};

export default function DonationCard({
  donation,
  showActions = false,
  onConfirm,
  onDispute,
}: DonationCardProps) {
  const status = statusConfig[donation.status];
  const StatusIcon = status.icon;

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <Link href={`/profile/${donation.donor_id}`} className="flex items-center gap-3">
          {donation.donor_pic ? (
            <img
              src={donation.donor_pic}
              alt={donation.donor_name}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
              {getInitials(donation.donor_name)}
            </div>
          )}
          <div>
            <span className="font-medium text-gray-900">
              {donation.donor_name || 'Anonymous'}
            </span>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{formatRelativeTime(donation.created_at)}</span>
            </div>
          </div>
        </Link>

        <span className={cn('badge flex items-center gap-1', status.color)}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
      </div>

      <p className="text-gray-800 mb-4">{donation.description}</p>

      {donation.photo_url && (
        <img
          src={donation.photo_url}
          alt="Donation"
          className="rounded-lg w-full max-h-64 object-cover mb-4"
        />
      )}

      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <div className="flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          <span>
            {donation.latitude.toFixed(4)}, {donation.longitude.toFixed(4)}
          </span>
        </div>
        <span className="font-medium text-primary-600">
          +{donation.points_awarded} Karma
        </span>
      </div>

      {donation.status === 'pending' && donation.challenge_deadline && (
        <div className="text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg mb-4">
          <Clock className="h-4 w-4 inline mr-1" />
          Challenge deadline: {new Date(donation.challenge_deadline).toLocaleDateString()}
        </div>
      )}

      {donation.receiver_name && (
        <div className="text-sm text-gray-600 mb-4">
          Received by: <span className="font-medium">{donation.receiver_name}</span>
        </div>
      )}

      {showActions && donation.status === 'pending' && (
        <div className="flex gap-2 pt-4 border-t">
          <button onClick={onConfirm} className="btn-primary flex-1">
            Confirm Receipt
          </button>
          <button onClick={onDispute} className="btn-danger flex-1">
            Dispute
          </button>
        </div>
      )}
    </div>
  );
}
