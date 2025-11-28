import Image from "next/image";

export default function AvailableSports({ sports_available }) {
    return (
        <div className="flex flex-wrap items-center justify-start py-2">
            {sports_available.map((sport, index) => (
                <div key={index} className="flex flex-col items-center justify-evenly h-30 w-30 p-5 m-5 border shadow-sm hover:shadow-green-300 transition-all duration-300 will-change-transform hover:shadow-lg hover:-translate-y-1 hover:z-10 cursor-pointer" >
                    <Image
                        src={`/assets/icons/${sport.toLowerCase()}.png`}
                        alt={`${sport.toLowerCase()}`}
                        width={20}
                        height={20}
                    />
                    <p className="font-bold"> {sport} </p>
                </div>
            ))}
        </div>
    )
}