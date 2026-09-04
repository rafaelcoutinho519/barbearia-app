document.addEventListener("DOMContentLoaded", () => {
    const professionals = [
        {
            id: 1,
            name: "Karlos",
            role: "Master Barber",
            avatar: "Karlos/Karlos 06 Perfil.png",
            gallery: [
                "Karlos/Karlos 01 Corte só na tesoura.jpeg",
                "Karlos/Karlos 02 Low fade.jpeg",
                "Karlos/Karlos 03 Mid Fade.jpeg",
                "Karlos/Karlos 04 Barba Italiana.jpeg",
                "Karlos/Karlos 05 Americano.jpeg"
            ],
            services: [
                { name: "Corte só na tesoura", price: "R$ 50,00" },
                { name: "Low Fade", price: "R$ 45,00" },
                { name: "Mid Fade", price: "R$ 45,00" },
                { name: "Barba Italiana", price: "R$ 40,00" },
                { name: "Corte Americano", price: "R$ 45,00" }
            ]
        },
        {
            id: 2,
            name: "Dorgival",
            role: "Fade Specialist",
            avatar: "Dorgival/Dorgival 07 Perfil.jpeg",
            gallery: [
                "Dorgival/Dorgival 01 Corte Americano.jpeg",
                "Dorgival/Dorgival 02 Americano Frestyle.jpeg",
                "Dorgival/Dorgival 03 Mid fade.jpeg",
                "Dorgival/Dorgival 04 Corte + Pigmentação.jpeg",
                "Dorgival/Dorgival 05 Moicano.jpeg",
                "Dorgival/Dorgival 06 Barba Pigmentada.jpeg"
            ],
            services: [
                { name: "Corte Americano", price: "R$ 45,00" },
                { name: "Americano Freestyle", price: "R$ 55,00" },
                { name: "Mid Fade", price: "R$ 45,00" },
                { name: "Corte + Pigmentação", price: "R$ 70,00" },
                { name: "Moicano", price: "R$ 45,00" },
                { name: "Barba Pigmentada", price: "R$ 50,00" }
            ]
        },
        {
            id: 3,
            name: "David",
            role: "Stylist & Beard",
            avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400", // Placeholder até o David mandar as fotos
            gallery: [],
            services: [
                { name: "Corte Clássico", price: "R$ 40,00" },
                { name: "Barba Completa", price: "R$ 35,00" }
            ]
        }
    ];

    const container = document.getElementById("professionals-container");
    if (!container) return;

    container.innerHTML = professionals.map(prof => `
        <div class="professional-card" style="background: #111; border: 1px solid #333; border-radius: 8px; padding: 20px; margin-bottom: 20px; color: #fff;">
            <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 15px;">
                <img src="${prof.avatar}" alt="${prof.name}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #d4af37;">
                <div>
                    <h2 style="margin: 0; color: #d4af37; font-size: 1.5rem;">${prof.name}</h2>
                    <p style="margin: 5px 0 0; color: #aaa; font-size: 0.95rem;">${prof.role}</p>
                </div>
            </div>
            
            <h3 style="font-size: 1.1rem; border-bottom: 1px solid #333; padding-bottom: 5px; margin-top: 15px;">Serviços & Preços</h3>
            <ul style="list-style: none; padding: 0; margin: 10px 0;">
                ${prof.services.map(s => `<li style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #222;"><span>${s.name}</span> <strong style="color: #d4af37;">${s.price}</strong></li>`).join('')}
            </ul>

            ${prof.gallery.length > 0 ? `
                <h3 style="font-size: 1.1rem; border-bottom: 1px solid #333; padding-bottom: 5px; margin-top: 15px;">Galeria de Trabalhos</h3>
                <div style="display: flex; gap: 10px; overflow-x: auto; padding-top: 10px;">
                    ${prof.gallery.map(img => `<img src="${img}" alt="Trabalho de ${prof.name}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 6px; border: 1px solid #444;">`).join('')}
                </div>
            ` : `<p style="color: #666; font-size: 0.85rem; font-style: italic; margin-top: 10px;">Galeria em breve...</p>`}
        </div>
    `).join('');
});
