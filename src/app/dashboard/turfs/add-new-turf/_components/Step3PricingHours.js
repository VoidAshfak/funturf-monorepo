import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function Step3PricingHours({ register, errors }) {
    return (
        <div className="space-y-4">
            <div>
                <Label htmlFor="pricePerHour">Price Per Hour (₹) *</Label>
                <Input
                    id="pricePerHour"
                    type="number"
                    placeholder="1000"
                    {...register('pricePerHour', {
                        required: 'Price is required',
                        min: { value: 0, message: 'Price must be positive' }
                    })}
                />
                {errors.pricePerHour && (
                    <span className="text-red-500 text-sm">{errors.pricePerHour.message}</span>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="openingTime">Opening Time *</Label>
                    <Input
                        id="openingTime"
                        type="time"
                        {...register('openingTime', { required: 'Opening time is required' })}
                    />
                    {errors.openingTime && (
                        <span className="text-red-500 text-sm">{errors.openingTime.message}</span>
                    )}
                </div>
                <div>
                    <Label htmlFor="closingTime">Closing Time *</Label>
                    <Input
                        id="closingTime"
                        type="time"
                        {...register('closingTime', { required: 'Closing time is required' })}
                    />
                    {errors.closingTime && (
                        <span className="text-red-500 text-sm">{errors.closingTime.message}</span>
                    )}
                </div>
            </div>

            <div>
                <Label htmlFor="advanceBookingDays">Advance Booking (days)</Label>
                <Input
                    id="advanceBookingDays"
                    type="number"
                    placeholder="7"
                    {...register('advanceBookingDays', {
                        min: { value: 1, message: 'Min 1 day' }
                    })}
                />
            </div>

            <div>
                <Label htmlFor="cancellationPolicy">Cancellation Policy</Label>
                <Textarea
                    id="cancellationPolicy"
                    placeholder="e.g., Free cancellation up to 24 hours before booking time..."
                    rows={3}
                    {...register('cancellationPolicy')}
                />
            </div>

            <div>
                <Label htmlFor="rules">Rules & Regulations</Label>
                <Textarea
                    id="rules"
                    placeholder="e.g., No outside food, proper sports attire required..."
                    rows={3}
                    {...register('rules')}
                />
            </div>
        </div>
    );
}