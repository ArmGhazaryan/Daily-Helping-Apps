document.addEventListener('DOMContentLoaded', async () => {
    
    const SUPABASE_URL = 'https://ypdjnzqkvqgjcrgtefsf.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_7_tQfI0y-jCQODj2RGMxyw_MSXMfHlb';

    // Ստեղծում ենք Supabase կապը
    const { createClient } = supabase;
    const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    let flashcardsData = [];
    let currentIndex = 0; 

    // DOM Էլեմենտներ
    const card = document.getElementById('myCard');
    const frontWord = document.getElementById('frontWord');
    const frontPhonetics = document.getElementById('frontPhonetics');
    const frontLevel = document.getElementById('frontLevel');
    const backLevel = document.getElementById('backLevel');
    const backDefinition = document.getElementById('backDefinition');
    const backExample = document.getElementById('backExample');
    
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const counter = document.getElementById('counter');
    const cardsGallery = document.getElementById('cardsGallery');

    const modal = document.getElementById('addWordModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveWordBtn = document.getElementById('saveWordBtn');

    // 1. ԲԱԶԱՅԻՑ ԲԱՌԵՐԻ ՍՏԱՑՈՒՄ (FETCH FROM CLOUD)
    async function fetchFlashcards() {
        try {
            const { data, error } = await _supabase.from('flashcards').select('*');
            if (error) throw error;
            
            flashcardsData = data || [];
            
            // Եթե բազան դատարկ է, լցնում ենք սկզբնական բառերով
            if (flashcardsData.length === 0) {
                await seedInitialData();
            } else {
                loadCard(currentIndex);
            }
        } catch (err) {
            console.error('Error fetching data:', err.message);
            alert('Չհաջողվեց միանալ ամպային բազային: Ստուգիր կապդ:');
        }
    }

    async function seedInitialData() {
        const initialWords = [
            {
                word: "Serendipity", phonetics: "/ˌser.ənˈdɪp.ə.ti/", level: "C1",
                definition: "The occurrence and development of events by chance in a happy or beneficial way.",
                example: "We found the perfect restaurant by pure serendipity."
            },
            {
                word: "Resilient", phonetics: "/rɪˈzɪl.jənt/", level: "B2",
                definition: "Able to withstand or recover quickly from difficult conditions.",
                example: "She's a resilient girl - she won't let this failure get her down."
            },
            {
                word: "Adequate", phonetics: "/ˈæd.ə.kwət/", level: "B1",
                definition: "Satisfactory or acceptable in quality or quantity.",
                example: "This office is perfectly adequate for my needs."
            }
        ];

        const { error } = await _supabase.from('flashcards').insert(initialWords);
        if (!error) {
            fetchFlashcards();
        }
    }

    // 2. ՆԿԱՐԵԼՈՒ ՖՈՒՆԿՑԻԱՆԵՐ
    function renderGallery() {
        cardsGallery.innerHTML = '';
        flashcardsData.forEach((data, index) => {
            const miniCard = document.createElement('div');
            miniCard.className = `mini-card ${index === currentIndex ? 'active' : ''}`;
            miniCard.textContent = data.word;
            
            miniCard.addEventListener('click', () => {
                currentIndex = index;
                loadCard(currentIndex);
            });
            
            cardsGallery.appendChild(miniCard);
        });
    }

    function loadCard(index) {
        if (flashcardsData.length === 0) {
            frontWord.textContent = "Դատարկ է";
            frontPhonetics.textContent = "";
            backDefinition.textContent = "Խնդրում ենք ավելացնել նոր բառեր:";
            backExample.textContent = "";
            frontLevel.textContent = "-";
            backLevel.textContent = "-";
            frontLevel.style.backgroundColor = '#475569';
            backLevel.style.backgroundColor = '#475569';
            counter.textContent = "0 / 0";
            
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            deleteBtn.disabled = true;
            cardsGallery.innerHTML = '';
            card.classList.remove('is-flipped');
            return;
        }

        deleteBtn.disabled = false;
        const data = flashcardsData[index];
        
        frontWord.textContent = data.word;
        frontPhonetics.textContent = data.phonetics || ''; 
        backDefinition.textContent = data.definition;
        backExample.textContent = data.example ? `"${data.example}"` : '';

        frontLevel.textContent = data.level;
        backLevel.textContent = data.level;

        let levelColor = '#10b981'; 
        if (data.level === 'B2') levelColor = '#3b82f6'; 
        if (data.level === 'C1') levelColor = '#8b5cf6'; 
        if (data.level === 'C2') levelColor = '#ef4444'; 
        
        frontLevel.style.backgroundColor = levelColor;
        backLevel.style.backgroundColor = levelColor;

        counter.textContent = `${index + 1} / ${flashcardsData.length}`;
        prevBtn.disabled = index === 0; 
        nextBtn.disabled = index === flashcardsData.length - 1; 
        
        card.classList.remove('is-flipped');
        renderGallery(); 
        
        setTimeout(() => {
            const activeMiniCard = document.querySelector('.mini-card.active');
            if (activeMiniCard) {
                activeMiniCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }, 50);
    }

    // 3. ԻՐԱԴԱՐՁՈՒԹՅՈՒՆՆԵՐ (Events)
    card.addEventListener('click', () => {
        if (flashcardsData.length > 0) {
            card.classList.toggle('is-flipped');
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentIndex < flashcardsData.length - 1) {
            currentIndex++;
            loadCard(currentIndex);
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            loadCard(currentIndex);
        }
    });

    // 4. ՋՆՋԵԼՈՒ ՏՐԱՄԱԲԱՆՈՒԹՅՈՒՆ (SUPABASE-ԻՑ)
    deleteBtn.addEventListener('click', async () => {
        if (flashcardsData.length === 0) return;
        
        const currentCard = flashcardsData[currentIndex];
        const isConfirmed = confirm(`Վստա՞հ եք, որ ցանկանում եք ջնջել "${currentCard.word}" բառը ամպային բազայից:`);
        
        if (isConfirmed) {
            const { error } = await _supabase.from('flashcards').delete().eq('word', currentCard.word);
            
            if (error) {
                alert("Չհաջողվեց ջնջել բառը:");
                return;
            }

            currentIndex = 0;
            fetchFlashcards(); // Թարմացնում ենք ցուցակը բազայից
        }
    });

    // 5. ՆՈՐ ԲԱՌ ԱՎԵԼԱՑՆԵԼՈՒ ՏՐԱՄԱԲԱՆՈՒԹՅՈՒՆԸ (SUPABASE)
    openModalBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    function closeModal() {
        modal.style.display = 'none';
        document.getElementById('newWord').value = '';
        document.getElementById('newPhonetics').value = '';
        document.getElementById('newDefinition').value = '';
        document.getElementById('newExample').value = '';
        document.getElementById('newLevel').value = 'B2';
    }

    cancelBtn.addEventListener('click', closeModal);

    saveWordBtn.addEventListener('click', async () => {
        const wordVal = document.getElementById('newWord').value.trim();
        const defVal = document.getElementById('newDefinition').value.trim();
        
        if (!wordVal || !defVal) {
            alert("Խնդրում ենք լրացնել 'Word' և 'Definition' դաշտերը:");
            return;
        }

        const newCard = {
            word: wordVal,
            level: document.getElementById('newLevel').value,
            definition: defVal,
            example: document.getElementById('newExample').value.trim()
        };

        // Ուղարկում ենք Supabase ամպային բազա
        const { error } = await _supabase.from('flashcards').insert([newCard]);
        
        if (error) {
            alert("Սխալ բազայում պահպանելիս: Հնարավոր է այս բառն արդեն գոյություն ունի:");
            console.error(error);
            return;
        }

        closeModal();
        fetchFlashcards(); // Թարմացնում ենք ամբողջ ցուցակը բազայից
    });

    // Առաջնային բեռնում բազայից
    fetchFlashcards();
});