const express=require("express");
const cors=require("cors");
const {Pool}=require("pg");

const app=express();
const PORT=process.env.PORT||3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// PostgreSQL connection
const pool=new Pool({
    connectionString:process.env.DATABASE_URL,
    ssl:{
        rejectUnauthorized:false
    }
});

// Maximum amount of stored messages
const MAX_MESSAGES=1000;

// Create the messages table automatically
async function setupDatabase(){
    await pool.query(`
        CREATE TABLE IF NOT EXISTS announcements(
            id SERIAL PRIMARY KEY,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log("Database ready");
}

// Home / health check
app.get("/",(req,res)=>{
    res.send("Roblox message HTTP script online");
});

// Roblox polls this endpoint
app.get("/announcement",async(req,res)=>{

    try{

        // Atomically get and delete the oldest message
        const result=await pool.query(`
            DELETE FROM announcements
            WHERE id=(
                SELECT id
                FROM announcements
                ORDER BY id ASC
                LIMIT 1
            )
            RETURNING message
        `);

        const message=result.rows.length>0
            ?result.rows[0].message
            :null;

        const countResult=await pool.query(
            "SELECT COUNT(*) FROM announcements"
        );

        res.json({
            message:message,
            messagesLeft:Number(countResult.rows[0].count)
        });

    }catch(err){

        console.error("Error getting announcement:",err);

        res.status(500).json({
            message:null,
            error:"Database error"
        });

    }

});

// Website sends a message here
app.post("/announcement",async(req,res)=>{

    const message=req.body?.message;

    if(typeof message!=="string"||message.trim()===""){
        return res.status(400).json({
            success:false,
            error:"Message is required"
        });
    }

    try{

        // Add the message to the persistent queue
        await pool.query(
            "INSERT INTO announcements(message) VALUES($1)",
            [message.trim()]
        );

        // Keep only the newest MAX_MESSAGES messages
        await pool.query(`
            DELETE FROM announcements
            WHERE id IN(
                SELECT id
                FROM announcements
                ORDER BY id ASC
                OFFSET $1
            )
        `,[MAX_MESSAGES]);

        const countResult=await pool.query(
            "SELECT COUNT(*) FROM announcements"
        );

        const count=Number(countResult.rows[0].count);

        console.log("Announcement received:",message);
        console.log("Messages waiting:",count);

        res.json({
            success:true,
            messagesWaiting:count
        });

    }catch(err){

        console.error("Error saving announcement:",err);

        res.status(500).json({
            success:false,
            error:"Database error"
        });

    }

});

// View all queued messages
app.get("/messages",async(req,res)=>{

    try{

        const result=await pool.query(`
            SELECT id,message,created_at
            FROM announcements
            ORDER BY id ASC
        `);

        res.json({
            count:result.rows.length,
            messages:result.rows
        });

    }catch(err){

        console.error("Error getting messages:",err);

        res.status(500).json({
            error:"Database error"
        });

    }

});

// Clear every queued message
app.delete("/messages",async(req,res)=>{

    try{

        await pool.query("DELETE FROM announcements");

        res.json({
            success:true
        });

    }catch(err){

        console.error("Error clearing messages:",err);

        res.status(500).json({
            success:false
        });

    }

});

// Test route
app.get("/test",(req,res)=>{
    res.send("Test route works");
});

// Start everything
setupDatabase()
    .then(()=>{

        app.listen(PORT,"0.0.0.0",()=>{
            console.log(`Roblox message HTTP server running on port ${PORT}`);
        });

    })
    .catch(err=>{

        console.error("Failed to start database:",err);

    });
