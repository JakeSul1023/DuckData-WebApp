🦆 Waterfowl Migration Prediction System (Duck Data)

Overview
his repository is part of the Team-7_Waterfowl project and focuses primarily on frontend visualization for waterfowl migration patterns across the Mississippi Flyway. It integrates with the main repository (Team-7_Waterfowl), which handles machine learning predictions and data processing.

The frontend uses deck.gl and OpenStreetMap to render an interactive heatmap based on historical migration data from the TTU Wildlife Department. The ultimate goal is to visualize predicted migration patterns up to 10 days in advance, using real-time NOAA weather data.

How This Repo Fits into Team-7_Waterfowl

    This repository focuses on the frontend and data visualization aspects
    The Team-7_Waterfowl repo contains the machine learning model and data processing pipeline
    The frontend will eventually integrate with the ML-generated CSV to display migration predictions

Current Features

    ✅ Historical Data Heatmap – Uses deck.gl to display past waterfowl migration patterns
    ✅ OpenStreetMap Tile Integration – Provides a detailed map for visualization
    ✅ CSV Data Handling – Reads and processes static migration data for display

Upcoming Features

    🚀 Machine Learning Model – A predictive model will be developed to forecast migration patterns up to 10 days in advance
    🌦 Weather Data Integration – NOAA weather data will be used as a key factor in migration predictions
    📊 Time-Slider Feature – Allows users to step through historical migration data over time
    🖥 High-Performance Computing (HPC) – The ML model will be optimized and run on TTU’s HPC system for large-scale predictions
    
How It Will Work

    1️⃣ Historical Data Processing – Migration records from TTU Wildlife Department will be preprocessed
    2️⃣ Weather-Based Predictions – The ML model will predict duck movements based on current weather conditions
    3️⃣ Heatmap Visualization – The React frontend will display past and predicted migrations as a heatmap
    4️⃣ CSV Output – The system will generate a predicted migration dataset for further use
    
Project Details

    Client: Dr. Cohen, TTU Wildlife Department
    Data Sources: TTU Wildlife Department (Migration Data), NOAA (Weather Data)
    Tech Stack: React, Deck.gl, OpenStreetMap, Python (ML), R (Data Processing), HPC
