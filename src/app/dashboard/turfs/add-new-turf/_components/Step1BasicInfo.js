import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function Step1BasicInfo({ register, errors }) {
    return (
        <div className="space-y-4">
            <div>
                <Label htmlFor="venueName">Venue Name *</Label>
                <Input
                    id="venueName"
                    placeholder="e.g., Green Valley Sports Arena"
                    {...register('venueName', { required: 'Venue name is required' })}
                />
                {errors.venueName && (
                    <span className="text-red-500 text-sm">{errors.venueName.message}</span>
                )}
            </div>

            <div>
                <Label htmlFor="address">Address *</Label>
                <Textarea
                    id="address"
                    placeholder="Street address"
                    {...register('address', { required: 'Address is required' })}
                />
                {errors.address && (
                    <span className="text-red-500 text-sm">{errors.address.message}</span>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                        id="city"
                        placeholder="City"
                        {...register('city', { required: 'City is required' })}
                    />
                    {errors.city && (
                        <span className="text-red-500 text-sm">{errors.city.message}</span>
                    )}
                </div>
                <div>
                    <Label htmlFor="state">State *</Label>
                    <Input
                        id="state"
                        placeholder="State"
                        {...register('state', { required: 'State is required' })}
                    />
                    {errors.state && (
                        <span className="text-red-500 text-sm">{errors.state.message}</span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="pincode">Pincode *</Label>
                    <Input
                        id="pincode"
                        placeholder="123456"
                        {...register('pincode', {
                            required: 'Pincode is required',
                            pattern: { value: /^\d{6}$/, message: 'Invalid pincode' }
                        })}
                    />
                    {errors.pincode && (
                        <span className="text-red-500 text-sm">{errors.pincode.message}</span>
                    )}
                </div>
                <div>
                    <Label htmlFor="contactPhone">Contact Phone *</Label>
                    <Input
                        id="contactPhone"
                        placeholder="+91 98765 43210"
                        {...register('contactPhone', {
                            required: 'Phone is required',
                            pattern: { value: /^[+]?[\d\s-()]+$/, message: 'Invalid phone' }
                        })}
                    />
                    {errors.contactPhone && (
                        <span className="text-red-500 text-sm">{errors.contactPhone.message}</span>
                    )}
                </div>
            </div>

            <div>
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="venue@example.com"
                    {...register('email', {
                        pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' }
                    })}
                />
                {errors.email && (
                    <span className="text-red-500 text-sm">{errors.email.message}</span>
                )}
            </div>
        </div>
    );
}