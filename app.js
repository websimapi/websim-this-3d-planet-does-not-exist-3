const { useState, useEffect, useRef, useSyncExternalStore } = React;

// Helper functions
const generateUniqueId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

// Generate a name for the planet based on its features
const generatePlanetName = (description) => {
  const prefixes = ['Kepler', 'Gliese', 'HD', 'Tau', 'Sigma', 'Omega', 'Alpha', 'Beta', 'Nova', 'Proxima'];
  const suffixes = ['b', 'c', 'd', 'e', 'f', 'g', 'Prime', 'Major', 'Minor', 'Ceti'];
  
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  
  // Add a random number
  const number = Math.floor(Math.random() * 999) + 1;
  
  return `${prefix}-${number}${suffix}`;
};

// Component for loading indicator
const LoadingIndicator = () => {
  return (
    <div className="loading-indicator">
      <div></div>
      <div></div>
      <div></div>
    </div>
  );
};

// Component for planet card in gallery
const PlanetCard = ({ planet }) => {
  const planetViewRef = useRef(null);
  const planetRendererRef = useRef(null);
  
  useEffect(() => {
    if (planetViewRef.current && planet.imageUrl) {
      const containerId = `planet-view-${planet.id}`;
      planetViewRef.current.id = containerId;
      
      // Create a new planet renderer
      planetRendererRef.current = new PlanetRenderer(containerId, {
        size: 1.5,
        autoRotate: true
      });
      
      // Set the planet texture
      planetRendererRef.current.setTexture(planet.imageUrl)
        .catch(err => console.error(`Failed to apply texture to planet ${planet.id}:`, err));
      
      return () => {
        if (planetRendererRef.current) {
          planetRendererRef.current.cleanup();
        }
      };
    }
  }, [planet.id, planet.imageUrl]);
  
  return (
    <div className="planet-card">
      <div className="planet-view-wrapper">
        <div className="three-container" ref={planetViewRef}></div>
      </div>
      <div className="planet-info">
        <h3>{planet.name}</h3>
        <p>{planet.description}</p>
        <div className="planet-meta">
          <span>Created by: {planet.username}</span>
          <span>{formatDate(planet.created_at)}</span>
        </div>
      </div>
    </div>
  );
};

// Main App component
const App = () => {
  const room = useRef(null);
  const currentPlanetRendererRef = useRef(null);
  const planetInputRef = useRef('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlanet, setGeneratedPlanet] = useState(null);
  const [generationError, setGenerationError] = useState('');

  // Initialize WebSocket connection
  useEffect(() => {
    room.current = new WebsimSocket();
    
    return () => {
      if (currentPlanetRendererRef.current) {
        currentPlanetRendererRef.current.cleanup();
      }
    };
  }, []);

  // Get planets from the database
  const planets = useSyncExternalStore(
    (callback) => room.current ? room.current.collection('planet').subscribe(callback) : () => {},
    () => room.current ? room.current.collection('planet').getList() : []
  );

  // Set up the planet renderer when a new planet is generated
  useEffect(() => {
    if (generatedPlanet && generatedPlanet.imageUrl) {
      if (currentPlanetRendererRef.current) {
        currentPlanetRendererRef.current.cleanup();
      }
      
      const planetRenderer = new PlanetRenderer('current-planet-view', {
        size: 2,
        autoRotate: true
      });
      
      planetRenderer.setTexture(generatedPlanet.imageUrl)
        .catch(err => {
          console.error('Failed to apply texture to current planet:', err);
          setGenerationError('Failed to apply planet texture. Please try again.');
        });
      
      currentPlanetRendererRef.current = planetRenderer;
    }
    
    return () => {
      if (currentPlanetRendererRef.current) {
        currentPlanetRendererRef.current.cleanup();
        currentPlanetRendererRef.current = null;
      }
    };
  }, [generatedPlanet]);

  const handleGeneratePlanet = async (e) => {
    e.preventDefault();
    
    const prompt = planetInputRef.current.value.trim();
    if (!prompt) {
      setGenerationError('Please enter a prompt to generate a planet');
      return;
    }
    
    setIsGenerating(true);
    setGenerationError('');
    
    try {
      // Step 1: Generate a detailed description of the planet using the LLM
      const planetDescriptionResult = await websim.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a planetary scientist and science fiction writer. Create a detailed and scientifically plausible description of an exoplanet based on the user's prompt. 
            Include details about its atmosphere, terrain, unique features, potential for life, and any other interesting astronomical characteristics.
            Keep the description between 150-200 words. Use vivid language that would help a visual artist create an image of this planet.`
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });
      
      const planetDescription = planetDescriptionResult.content;
      
      // Step 2: Generate the image prompt based on the description
      const imagePromptResult = await websim.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an expert at creating detailed text-to-image prompts. Your task is to convert a planet description into a detailed prompt for generating a planetary texture map.
            The prompt should describe the surface features, colors, atmosphere, and unique characteristics that would make a visually stunning planet texture.
            Format your response as a single paragraph with no introduction or explanation. Focus on visual elements only.
            The result will be used directly as input to an image generation model to create a spherical planet texture.`
          },
          {
            role: "user",
            content: `Create an image generation prompt for this planet description: ${planetDescription}`
          }
        ]
      });
      
      const imagePrompt = imagePromptResult.content;
      
      // Step 3: Generate the planet image
      const imageResult = await websim.imageGen({
        prompt: `Spherical planet texture map. ${imagePrompt}. Seamless, detailed surface features, planetary texture, high resolution, space art.`,
        aspect_ratio: "1:1",
      });
      
      const planetName = generatePlanetName(planetDescription);
      
      // Store the generated planet data
      const newPlanet = {
        name: planetName,
        description: planetDescription,
        originalPrompt: prompt,
        imagePrompt: imagePrompt,
        imageUrl: imageResult.url
      };
      
      setGeneratedPlanet(newPlanet);
      
      // Save to database
      if (room.current) {
        await room.current.collection('planet').create(newPlanet);
      }
      
    } catch (error) {
      console.error('Error generating planet:', error);
      setGenerationError('Failed to generate planet. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>This 3D Planet Does Not Exist</h1>
        <p>Generate unique alien planets with AI and explore them in 3D</p>
      </header>
      
      <section className="planet-generator">
        <form className="generation-form" onSubmit={handleGeneratePlanet}>
          <div className="form-group">
            <label htmlFor="planet-prompt">Describe your planet:</label>
            <textarea 
              id="planet-prompt"
              ref={planetInputRef}
              placeholder="E.g., A ringed gas giant with swirling storms and blue clouds, orbiting a binary star system..."
              disabled={isGenerating}
            ></textarea>
          </div>
          
          <button type="submit" disabled={isGenerating}>
            {isGenerating ? <LoadingIndicator /> : 'Generate Planet'}
          </button>
          
          {generationError && <p className="error-message">{generationError}</p>}
        </form>
        
        {generatedPlanet && (
          <div className="generated-planet">
            <div id="current-planet-view" className="planet-renderer"></div>
            <div className="planet-info">
              <h3>{generatedPlanet.name}</h3>
              <p>{generatedPlanet.description}</p>
            </div>
          </div>
        )}
      </section>
      
      <section className="planets-gallery">
        <div className="gallery-heading">
          <h2>Planet Gallery</h2>
          <p>Explore planets created by other users</p>
        </div>
        
        <div className="gallery-grid">
          {planets && planets.length > 0 ? (
            [...planets].reverse().map(planet => (
              <PlanetCard key={planet.id} planet={planet} />
            ))
          ) : (
            <p>No planets generated yet. Be the first to create one!</p>
          )}
        </div>
      </section>
    </div>
  );
};

// Render the app
ReactDOM.createRoot(document.getElementById('app')).render(<App />);

