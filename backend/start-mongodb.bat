@echo off
echo Iniciando MongoDB en Docker...
echo.

REM Verificar si el contenedor ya existe
docker ps -a --filter "name=mongodb-bumblebee" --format "{{.Names}}" > temp.txt
set /p CONTAINER_EXISTS=<temp.txt
del temp.txt

if "%CONTAINER_EXISTS%"=="mongodb-bumblebee" (
    echo Contenedor MongoDB ya existe. Iniciandolo...
    docker start mongodb-bumblebee
) else (
    echo Creando nuevo contenedor MongoDB...
    docker run -d ^
        --name mongodb-bumblebee ^
        -p 27017:27017 ^
        -e MONGO_INITDB_DATABASE=bumblebee_game ^
        -v mongodb_bumblebee_data:/data/db ^
        mongo:latest
)

echo.
echo ✅ MongoDB esta corriendo en puerto 27017
echo.
echo Para detener MongoDB ejecuta: docker stop mongodb-bumblebee
echo Para ver logs ejecuta: docker logs mongodb-bumblebee
echo.
pause
