import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SPORTS, AMENITIES, TURF_TYPES } from '../../../../../utils/constants';

export default function Step2VenueDetails({
    register,
    errors,
    selectedSports,
    selectedAmenities,
    toggleSport,
    toggleAmenity,
    setValue
}) {
    return (
        <div className="space-y-4">
            <div>
                <Label>Sports Available *</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                    {SPORTS.map(sport => (
                        <div
                            key={sport}
                            onClick={() => toggleSport(sport)}
                            className={`cursor-pointer p-3 rounded-lg border-2 text-center transition-all ${selectedSports.includes(sport)
                                    ? 'border-green-600 bg-green-50 text-green-700'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            {sport}
                        </div>
                    ))}
                </div>
                <input
                    type="hidden"
                    {...register('sports', {
                        validate: v => v.length > 0 || 'Select at least one sport'
                    })}
                />
                {errors.sports && (
                    <span className="text-red-500 text-sm">{errors.sports.message}</span>
                )}
            </div>

            <div>
                <Label htmlFor="turfType">Turf Type *</Label>
                <Select onValueChange={(value) => setValue('turfType', value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select turf type" />
                    </SelectTrigger>
                    <SelectContent>
                        {TURF_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                                {type.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <input
                    type="hidden"
                    {...register('turfType', { required: 'Turf type is required' })}
                />
                {errors.turfType && (
                    <span className="text-red-500 text-sm">{errors.turfType.message}</span>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="width">Width (meters) *</Label>
                    <Input
                        id="width"
                        type="number"
                        placeholder="30"
                        {...register('width', {
                            required: 'Width is required',
                            min: { value: 1, message: 'Min 1 meter' }
                        })}
                    />
                    {errors.width && (
                        <span className="text-red-500 text-sm">{errors.width.message}</span>
                    )}
                </div>
                <div>
                    <Label htmlFor="length">Length (meters) *</Label>
                    <Input
                        id="length"
                        type="number"
                        placeholder="50"
                        {...register('length', {
                            required: 'Length is required',
                            min: { value: 1, message: 'Min 1 meter' }
                        })}
                    />
                    {errors.length && (
                        <span className="text-red-500 text-sm">{errors.length.message}</span>
                    )}
                </div>
            </div>

            <div>
                <Label>Amenities</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                    {AMENITIES.map(amenity => (
                        <div key={amenity} className="flex items-center space-x-2">
                            <Checkbox
                                id={amenity}
                                checked={selectedAmenities.includes(amenity)}
                                onCheckedChange={() => toggleAmenity(amenity)}
                            />
                            <label htmlFor={amenity} className="text-sm cursor-pointer">
                                {amenity}
                            </label>
                        </div>
                    ))}
                </div>
                <input type="hidden" {...register('amenities')} />
            </div>

            <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                    id="description"
                    placeholder="Describe your venue, facilities, and any special features..."
                    rows={4}
                    {...register('description')}
                />
            </div>
        </div>
    );
}