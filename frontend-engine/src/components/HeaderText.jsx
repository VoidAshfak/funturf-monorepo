import React from 'react';
import { MapPin } from "lucide-react"


const HeaderText = ({ title, subtitle, className, center = false, mapIcon = false }) => {
    return (
        <div className={`${center ? 'text-center' : 'text-left'} ${className}`}>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-widest">
                {title}
            </h2>
            {subtitle && (
                <div className={`flex items-center gap-2 mt-4 ${mapIcon ? "" : "justify-center"}`}>
                    {mapIcon && <MapPin className="w-5 h-5" />}
                    <p className={`text-lg text-muted-foreground ${mapIcon ? "" : "mt-2"}`}>
                        {subtitle}
                    </p>
                </div>
            )}
        </div>
    );
};

export default HeaderText;
