import React from 'react';
import { Badge } from '@/components/ui/badge';

export default function Step4Review({ formData, selectedSports, selectedAmenities }) {
    return (
        <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-green-800 mb-4">
                    Review Your Turf Details
                </h3>

                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Basic Information</h4>
                        <div className="text-sm space-y-1 text-gray-600">
                            <p><strong>Venue:</strong> {formData.venueName}</p>
                            <p>
                                <strong>Address:</strong> {formData.address}, {formData.city},
                                {formData.state} - {formData.pincode}
                            </p>
                            <p><strong>Contact:</strong> {formData.contactPhone}</p>
                            {formData.email && <p><strong>Email:</strong> {formData.email}</p>}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Venue Details</h4>
                        <div className="text-sm space-y-1 text-gray-600">
                            <p>
                                <strong>Sports:</strong> {selectedSports.join(', ') || 'None selected'}
                            </p>
                            <p>
                                <strong>Turf Type:</strong>{' '}
                                {formData.turfType?.replace('_', ' ').toUpperCase()}
                            </p>
                            <p>
                                <strong>Dimensions:</strong> {formData.width}m × {formData.length}m
                            </p>
                            {selectedAmenities.length > 0 && (
                                <div>
                                    <strong>Amenities:</strong>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {selectedAmenities.map(a => (
                                            <Badge key={a} variant="secondary">{a}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Pricing & Hours</h4>
                        <div className="text-sm space-y-1 text-gray-600">
                            <p><strong>Price:</strong> ₹{formData.pricePerHour}/hour</p>
                            <p>
                                <strong>Hours:</strong> {formData.openingTime} - {formData.closingTime}
                            </p>
                            {formData.advanceBookingDays && (
                                <p>
                                    <strong>Advance Booking:</strong> {formData.advanceBookingDays} days
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}